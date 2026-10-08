/**
 * Phase 9 GOAL 2 — Inbox integration for support tickets (the golden rule).
 *
 * New ticket (client POST /portal/tickets) → inbox card: type
 * `support_ticket`, risk_tier `write`, client-voice tag. One ticket = one
 * card (dedupe on ticket_id in payload_json). Founder actions from the card:
 * Reply (posts founder message), Resolve (status → resolved); the card's
 * standard approve/deny map: approve = acknowledge (closes card), deny =
 * close ticket as resolved.
 *
 * Client reply on an in_progress ticket → unread_founder=true → the card
 * RE-SURFACES (bump: status back to pending, not a duplicate).
 *
 * This module exports helpers called from support-tickets.ts + the
 * approvals approve/reject handlers (special-cased by payload_json.kind).
 */
import { supabase } from './ctx';

/** Create (or bump) the INBOX card for a ticket. Never throws. */
export async function ticketInboxCard(
  ticket: { id: string; subject: string; priority: string; client_id: string },
  firstMessageExcerpt: string,
  clientName: string | null,
): Promise<void> {
  try {
    // Dedupe: one ticket = one card — reuse the pending card if it exists.
    const { data: existing } = await supabase
      .from('approvals')
      .select('id, status')
      .eq('type', 'support_ticket')
      .contains('payload_json', { ticket_id: ticket.id })
      .maybeSingle();

    if (existing) {
      // Bump, not duplicate: client replied → card re-surfaces for the founder.
      if (existing.status !== 'pending') {
        await supabase
          .from('approvals')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
      return;
    }

    await supabase.from('approvals').insert({
      type: 'support_ticket',
      risk_tier: 'write',
      client_id: ticket.client_id,
      title: ticket.subject,
      description: `${firstMessageExcerpt.slice(0, 160)}${firstMessageExcerpt.length > 160 ? '…' : ''} — ${clientName || 'client'} · priority: ${ticket.priority}`,
      status: 'pending',
      requested_by: 'client-voice',
      payload_json: {
        kind: 'support_ticket',
        ticket_id: ticket.id,
        client_id: ticket.client_id,
        client_name: clientName || null,
        priority: ticket.priority,
        excerpt: firstMessageExcerpt.slice(0, 400),
      },
    });
  } catch (e: any) {
    console.error('[ticket-inbox] card create failed:', e?.message || e);
  }
}

/** Close the ticket's inbox card (resolved/closed → card leaves the queue). Never throws. */
export async function closeTicketInboxCard(ticketId: string): Promise<void> {
  try {
    await supabase
      .from('approvals')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('type', 'support_ticket')
      .contains('payload_json', { ticket_id: ticketId })
      .neq('status', 'approved');
  } catch (e: any) {
    console.error('[ticket-inbox] card close failed:', e?.message || e);
  }
}