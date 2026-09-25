/*
 * routes/auth.ts — token minting endpoint (Phase 3 split, from index.ts L56–89).
 * SECURITY (P0 Fix 2): requires an existing valid director JWT; one-time
 * BOOTSTRAP_ADMIN_TOKEN may authorize the FIRST mint only; every use logged.
 * No behavior changes: same path, method, auth, response shape.
 */
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { app, JWT_SECRET, JWT_EXPIRES_IN } from '../ctx';

interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

app.post('/api/v1/auth/token', async (req: Request, res: Response) => {
  try {
    const { sub, role } = req.body || {};
    if (!sub || typeof sub !== 'string') {
      return res.status(400).json({ error: 'Missing sub (user/agent id)' });
    }

    // --- authorization check ---
    const authHeader = req.headers.authorization || '';
    const presented = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let authorized = false;
    let bootstrapUsed = false;

    if (presented) {
      try {
        const decoded = jwt.verify(presented, JWT_SECRET) as JwtPayload;
        if (decoded?.role === 'director') authorized = true;
      } catch {
        /* invalid/expired token → not authorized */
      }
    }

    // Bootstrap path: only for the very first mint (no valid director token
    // in circulation). Gated on a server-side env secret, logged loudly.
    if (!authorized && presented && process.env.BOOTSTRAP_ADMIN_TOKEN && presented === process.env.BOOTSTRAP_ADMIN_TOKEN) {
      authorized = true;
      bootstrapUsed = true;
      console.warn('[AUTH][BOOTSTRAP] First-mint bootstrap token used from', req.ip, '— rotate/remove BOOTSTRAP_ADMIN_TOKEN after bootstrap.');
    }

    if (!authorized) {
      return res.status(401).json({ error: 'Token mint requires an existing director JWT (or one-time BOOTSTRAP_ADMIN_TOKEN for first setup).' });
    }

    const token = jwt.sign(
      { sub, role: typeof role === 'string' ? role : 'director', ...(bootstrapUsed ? { via: 'bootstrap' } : {}) },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );
    const decoded = jwt.decode(token) as JwtPayload;
    res.json({
      token,
      token_type: 'Bearer',
      expires_at: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
