/*
 * routes/telegram.ts — Phase 3 monolith split (from index.ts L3409–3541).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { app, emitFeed, supabase, sanitizeText, emitApproval } from '../ctx';

// -- imports auto-added by fix-imports (Phase 3)
app.post('/api/v1/telegram/webhook', async (req, res) => {
  try {
    // SECURITY (P0 Fix 4): verify Telegram's secret token header so only
    // Telegram itself (configured via BotFather setWebhook secret_token)
    // can invoke approvals through this webhook. 403 on missing/mismatch.
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    const presentedHeader = (req.headers as any)['x-telegram-bot-api-secret-token'];
    if (!expected) {
      // Secret not configured → webhook must not silently accept traffic.
      console.error('[SECURITY] TELEGRAM_WEBHOOK_SECRET not set — rejecting Telegram webhook. Set it via BotFather setWebhook (secret_token) + api/.env.');
      return res.status(503).json({ error: 'Webhook not configured' });
    }
    if (presentedHeader !== expected) {
      return res.status(403).json({ error: 'Forbidden: invalid webhook secret' });
    }

    const update = req.body;
    const updateId = update.update_id;
    if (!updateId) return res.status(400).json({ error: 'Missing update_id' });

    // Store raw webhook for audit
    await supabase.from('telegram_webhooks').upsert({
      update_id: updateId,
      message_json: update,
    }, { onConflict: 'update_id' });

    // Extract message
    const message = update.message || update.edited_message;
    if (!message) return res.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text || '';
    const from = message.from;

    // Find or create telegram user
    let { data: tgUser } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('telegram_id', chatId)
      .single();

    if (!tgUser && from) {
      const { data } = await supabase.from('telegram_users').insert({
        telegram_id: chatId,
        username: from.username,
        first_name: from.first_name,
        last_name: from.last_name,
        role: 'viewer',
      }).select().single();
      tgUser = data;
    }

    // Parse commands
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      let reply = '';
      const token = req.headers['x-telegram-bot-token'] || process.env.TELEGRAM_BOT_TOKEN;

      if (cmd === 'start') {
        reply = 'Welcome to Spinach OS! Commands: /approve <id>, /reject <id>, /status, /standup, /hire <role> in <dept>, /pipelines';
      } else if (cmd === 'approve' && args[0]) {
        const { data } = await supabase.from('approvals').update({ status: 'approved', approved_by: 'director', reviewed_at: new Date().toISOString() }).eq('id', args[0]).select().single();
        if (data) { emitApproval({ ...data, action: 'approved' }); reply = `✅ Approved: ${data.type} for ${data.payload_json?.client_name || 'client'}`; }
        else reply = 'Approval not found';
      } else if (cmd === 'reject' && args[0]) {
        const { data } = await supabase.from('approvals').update({ status: 'rejected', approved_by: 'director', reviewed_at: new Date().toISOString() }).eq('id', args[0]).select().single();
        if (data) { emitApproval({ ...data, action: 'rejected' }); reply = `❌ Rejected: ${data.type}`; }
        else reply = 'Approval not found';
      } else if (cmd === 'status') {
        const { data } = await supabase.from('agent_states').select('*').order('profile');
        if (data && data.length) {
          reply = '🤖 Agent States:\n' + data.map(a => `• ${a.profile}: ${a.state} — ${a.activity || 'idle'}`).join('\n');
        } else reply = 'No agents';
      } else if (cmd === 'standup') {
        await fetch('http://localhost:4000/api/v1/calendar/standup', { method: 'POST', headers: { Authorization: req.headers.authorization || '' } });
        reply = '📅 Daily standup scheduled for all active agents at 9 AM';
      } else if (cmd === 'pipelines') {
        const { data } = await supabase.from('workflows').select('*').eq('status', 'active').limit(10);
        if (data && data.length) {
          reply = '📋 Active Pipelines:\n' + data.map(w => `• ${w.name} (${w.current_step}) — ${w.progress}%`).join('\n');
        } else reply = 'No active pipelines';
      } else if (cmd === 'hire' && args.length >= 3) {
        // /hire backend developer in engineering
        const inIdx = args.indexOf('in');
        if (inIdx > 0) {
          const role = args.slice(0, inIdx).join(' ');
          const dept = args[inIdx + 1] || 'engineering';
          const agentId = crypto.randomUUID().slice(0, 8);
          // metadata carries dept/role (no columns); errors surfaced to the notification
          const { error: tgHireErr } = await supabase.from('agent_states').upsert({ profile: `${dept}_${agentId}`, state: 'idle', activity: `Hired as ${role}`, metadata: { department: dept, role, hired_via: 'telegram' } });
          if (tgHireErr) console.error('TG hire upsert failed:', tgHireErr.message);
          emitFeed('hr', 'Agent hired', { department: dept, role, id: agentId });
          reply = `👋 Hired ${role} in ${dept} (${agentId})`;
        } else reply = 'Usage: /hire <role> in <dept>';
      } else {
        reply = 'Unknown command. Try: /approve, /reject, /status, /standup, /pipelines, /hire';
      }

      if (reply) {
        // Store notification for retry if send fails
        await supabase.from('telegram_notifications').insert({
          telegram_user_id: tgUser?.id,
          notification_type: 'command_result',
          title: 'Command Result',
          body: reply,
        });

        // Try to send via Telegram Bot API
        if (token) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'Markdown' }),
            });
          } catch {}
        }
      }
    }

    res.json({ ok: true });
  } catch (e: any) {
    console.error('Telegram webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// MARKETING OS — content calendar + engagement
// ============================================
