/*
 * api/src/providers/email.ts — Phase 12 GOAL 1: the real email sender.
 *
 * Reads the active sender from provider_keys (DB-backed BYOK — Phase 5
 * machinery). Resend first, then sendgrid, then smtp. Credentials NEVER in
 * code, NEVER logged, NEVER returned by any endpoint (status shows
 * connected/provider only).
 *
 * sendEmail({ to, subject, body, replyTo }) → { ok, provider, message_id }
 *  - no connected sender → { ok: false, reason: 'no_sender' }
 *  - provider failure   → { ok: false, reason: 'provider_error:<status>' }
 */

import { getStoredKey } from './publishing';
import { supabase as _sb } from '../ctx'; // type-only anchor; getStoredKey owns the DB read

const EMAIL_PROVIDERS = ['resend', 'sendgrid', 'smtp'] as const;

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: string;
  message_id?: string;
  reason?: string; // 'no_sender' | 'provider_error:<detail>' — never contains the key
}

/** Which sender is connected (for /providers/email/status — no secrets). */
export async function getEmailSender(): Promise<{ connected: boolean; provider: string | null }> {
  for (const p of EMAIL_PROVIDERS) {
    const key = await getStoredKey(p);
    if (key) return { connected: true, provider: p };
  }
  return { connected: false, provider: null };
}

/**
 * Deliver an email via the founder's connected sending identity.
 * Resend: POST https://api.resend.com/emails (Bearer key, from the env's
 * verified sender). SendGrid v3: /v3/mail/send. SMTP: deferred (needs nodemailer
 * wiring — status honestly reports connected but send falls to provider_error).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { connected, provider } = await getEmailSender();
  if (!connected || !provider) return { ok: false, provider: 'none', reason: 'no_sender' };

  const apiKey = await getStoredKey(provider);
  if (!apiKey) return { ok: false, provider, reason: 'no_sender' };

  // From-address: the workspace's verified sender (env override allowed).
  const from = process.env.EMAIL_FROM || 'Spinach Digital <onboarding@resend.dev>';

  try {
    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.body,
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        const errText = (await res.text()).slice(0, 200); // provider error body — no key ever in it
        return { ok: false, provider, reason: `provider_error:${res.status} ${errText}` };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: true, provider, message_id: data?.id || null };
    }

    if (provider === 'sendgrid') {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.to }] }],
          from: { email: (process.env.EMAIL_FROM || 'onboarding@resend.dev').replace(/.*<|>.*/g, '') },
          subject: input.subject,
          content: [{ type: 'text/plain', value: input.body }],
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      });
      // SendGrid v3 returns 202 on success, no body
      if (!res.ok) {
        const errText = (await res.text()).slice(0, 200);
        return { ok: false, provider, reason: `provider_error:${res.status} ${errText}` };
      }
      return { ok: true, provider, message_id: `sendgrid:${res.headers.get('x-message-id') || Date.now()}` };
    }

    if (provider === 'smtp') {
      // Phase 13 GOAL 1: nodemailer transport — the fallback behind Resend.
      // Key format (DB-backed, one string): host|port|user|pass
      // (optionally host|port|user|pass|from). A stale/failed key → honest
      // provider_error, NEVER a fake send. Credentials never logged.
      const parts = (apiKey || '').split('|').map(s => s.trim());
      if (parts.length < 4 || parts.some(p => !p)) {
        return { ok: false, provider, reason: 'provider_error:smtp key malformed — expected host|port|user|pass' };
      }
      const [host, portStr, user, pass, fromOverride] = parts;
      const port = parseInt(portStr, 10);
      if (!host || !port || !user || !pass) {
        return { ok: false, provider, reason: 'provider_error:smtp key malformed — expected host|port|user|pass' };
      }
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host, port,
        secure: port === 465,
        auth: { user, pass },
      });
      const info = await transporter.sendMail({
        from: fromOverride || from,
        to: input.to,
        subject: input.subject,
        text: input.body,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });
      return { ok: true, provider, message_id: info?.messageId || null };
    }

    return { ok: false, provider, reason: `provider_error:unknown provider ${provider}` };
  } catch (e: any) {
    return { ok: false, provider, reason: `provider_error:${String(e?.message || e).slice(0, 200)}` };
  }
}
