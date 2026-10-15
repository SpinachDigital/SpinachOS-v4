import webpush from 'web-push';
import { supabase } from './ctx';

export interface PushMessage {
  title: string;
  body: string;
  link?: string;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ops@spinachdigital.com', pub, priv);
  configured = true;
  return true;
}

/**
 * Send a push to every subscription of a user.
 * Removes subscriptions that the push service reports as gone/invalid (410/404).
 * Never throws — push is best-effort, the caller's main flow must not break.
 */
export async function sendPushToUser(
  userEmail: string,
  msg: PushMessage
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_email', userEmail);
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: msg.title, body: msg.body, link: msg.link })
      );
      sent++;
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
    } catch (err: any) {
      failed++;
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // subscription gone — clean it up so we don't retry dead endpoints forever
        await supabase.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
  }
  return { sent, failed };
}

/** The founder's inbox — every buzz routes here. */
export const FOUNDER_EMAIL = 'founder@spinachdigital.com';
