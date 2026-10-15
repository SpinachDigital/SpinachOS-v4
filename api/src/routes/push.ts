/**
 * N4 §1: Web Push subscription endpoints (ctx-style: bare app.get/post on the ONE app).
 * GET  /api/v1/push/vapid-key   — public key for the browser's applicationServerKey
 * POST /api/v1/push/subscribe   — upsert { endpoint, keys: { p256dh, auth } }
 * POST /api/v1/push/unsubscribe — remove { endpoint }
 * POST /api/v1/push/test        — one test buzz to all of the user's subscriptions
 *
 * The PRIVATE VAPID key lives only in api/.env (gitignored). It never enters a
 * response body, a log line, or the repo.
 */
import { app, authMiddleware, supabase } from '../ctx';
import { sendPushToUser } from '../push';

// Public key — safe to expose, it is designed to be public.
app.get('/api/v1/push/vapid-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'push not configured (VAPID_PUBLIC_KEY missing)' });
  res.json({ public_key: key });
});

app.post('/api/v1/push/subscribe', authMiddleware, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint and keys.p256dh/keys.auth required' });
  }
  const email = (req as any).user?.email || 'founder@spinachdigital.com';
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_email: email,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,endpoint' }
    )
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, id: data.id });
});

app.post('/api/v1/push/unsubscribe', authMiddleware, async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  const email = (req as any).user?.email || 'founder@spinachdigital.com';
  const { data, error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_email', email)
    .eq('endpoint', endpoint)
    .select('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, removed: (data || []).length });
});

// Test buzz — explicit, user-initiated from Settings. Never auto-fired.
app.post('/api/v1/push/test', authMiddleware, async (req, res) => {
  const email = (req as any).user?.email || 'founder@spinachdigital.com';
  const result = await sendPushToUser(email, {
    title: 'Spinach OS — test push',
    body: 'If you can read this, gate pushes reach your phone.',
    link: '/approvals',
  });
  res.json({ ok: true, ...result });
});
