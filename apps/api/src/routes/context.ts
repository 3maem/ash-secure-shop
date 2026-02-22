import { Router } from 'express';
import crypto from 'node:crypto';
import {
  ashDeriveClientSecret,
  ashNormalizeBinding,
} from '@3maem/ash-node-sdk';
import { ashStore } from '../lib/context-store.js';

const router = Router();

router.get('/api/context', async (req, res) => {
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
