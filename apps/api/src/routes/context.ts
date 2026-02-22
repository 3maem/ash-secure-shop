import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import {
  ashDeriveClientSecret,
  ashNormalizeBinding,
} from '@3maem/ash-node-sdk';
import { ashStore } from '../lib/context-store.js';

// ─── Rate limiter for /api/context ───────────────────────────────
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 30;  // max 30 contexts per IP per minute

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale buckets every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
}, 120_000);

function contextRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }

  bucket.count++;

  res.setHeader('X-RateLimit-Limit', RATE_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_MAX_REQUESTS - bucket.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

  if (bucket.count > RATE_MAX_REQUESTS) {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many context requests. Try again later.',
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    });
    return;
  }

  next();
}

const router = Router();

router.get('/api/context', contextRateLimit, async (req, res) => {
  try {
    const method = String(req.query.method || 'POST').toUpperCase();
    const path = String(req.query.path || '/');
    const rawQuery = String(req.query.rawQuery || '');

    const binding = ashNormalizeBinding(method, path, rawQuery);
    const nonce = crypto.randomBytes(32).toString('hex');
    const contextId = `ctx-${crypto.randomBytes(16).toString('hex')}`;
    const now = Math.floor(Date.now() / 1000);

    const clientSecret = ashDeriveClientSecret(nonce, contextId, binding);

    await ashStore.store({
      id: contextId,
      nonce,
      binding,
      clientSecret,
      used: false,
      createdAt: now,
      expiresAt: now + 300,
    });

    res.json({ contextId, nonce, expiresAt: now + 300 });
  } catch (error) {
    console.error('Context creation error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create context' });
  }
});

export default router;
