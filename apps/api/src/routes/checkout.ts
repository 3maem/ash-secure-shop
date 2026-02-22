import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { ashVerifyRequest } from '@3maem/ash-node-sdk';
import { jwtAuth } from '../middleware/auth.js';
import { ashStore } from '../lib/context-store.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// POST /checkout/start — Unified ASH mode (scope: items, no chain yet)
router.post('/checkout/start', jwtAuth, async (req: Request, res: Response) => {
  try {
    const contextId = req.headers['x-ash-context-id'] as string;
    if (!contextId) {
      res.status(483).json({ error: 'ASH_PROOF_MISSING', message: 'Missing x-ash-context-id header' });
      return;
    }

    const ctx = await ashStore.consume(contextId);
    const body = JSON.stringify(req.body);

    const result = ashVerifyRequest({
      headers: req.headers as Record<string, string | string[] | undefined>,
      method: 'POST',
      path: '/checkout/start',
      body,
      nonce: ctx.nonce,
      contextId: ctx.id,
      scope: ['items'],
    });

    if (!result.ok) {
      res.status(result.error?.httpStatus || 460).json({
        error: result.error?.code,
        message: result.error?.message,
      });
      return;
    }

    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'items array is required' });
      return;
    }

    // Look up real prices from DB to prevent client-side price manipulation
    const productIds = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const priceMap = new Map(products.map(p => [p.id, p.price]));

    const verifiedItems = items.map((item: any) => {
      const realPrice = priceMap.get(item.productId);
      if (realPrice === undefined) throw new Error(`Product ${item.productId} not found`);
      return { productId: item.productId, qty: item.qty, price: realPrice };
    });

    const subtotal = verifiedItems.reduce((sum: number, i: any) => sum + i.price * i.qty, 0);
    const total = Math.round(subtotal * 100) / 100;

    const session = await prisma.checkoutSession.create({
      data: {
        userId: req.user!.userId,
        items: JSON.stringify(verifiedItems),
        subtotal,
        total,
        lastProof: req.headers['x-ash-proof'] as string,
        currentStep: 1,
        status: 'pending',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    res.status(201).json({
      sessionId: session.id,
      items: verifiedItems,
      subtotal,
      total,
      currency: 'SAR',
      step: 1,
      ash: { verified: true, mode: result.meta?.mode },
    });
  } catch (error: any) {
    console.error('Checkout start error:', error);
    const status = error.httpStatus || 500;
    res.status(status).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

// POST /checkout/confirm — Unified ASH mode (scope + chain to start)
router.post('/checkout/confirm', jwtAuth, async (req: Request, res: Response) => {
  try {
    const contextId = req.headers['x-ash-context-id'] as string;
    if (!contextId) {
      res.status(483).json({ error: 'ASH_PROOF_MISSING', message: 'Missing x-ash-context-id header' });
      return;
    }

    const ctx = await ashStore.consume(contextId);
    const body = JSON.stringify(req.body);
    const { sessionId, address, shippingMethod } = req.body;

    if (!sessionId || !address || !shippingMethod) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sessionId, address, and shippingMethod are required' });
      return;
    }

    const session = await prisma.checkoutSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== req.user!.userId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Checkout session not found' });
      return;
    }

    if (session.currentStep !== 1) {
      res.status(400).json({ error: 'INVALID_STEP', message: 'Session is not at step 1' });
      return;
    }

    const result = ashVerifyRequest({
      headers: req.headers as Record<string, string | string[] | undefined>,
      method: 'POST',
      path: '/checkout/confirm',
      body,
      nonce: ctx.nonce,
      contextId: ctx.id,
      scope: ['sessionId', 'address', 'shippingMethod'],
      previousProof: session.lastProof || undefined,
    });

    if (!result.ok) {
      res.status(result.error?.httpStatus || 460).json({
        error: result.error?.code,
        message: result.error?.message,
      });
      return;
    }

    const shippingCost = shippingMethod === 'express' ? 25.00 : 10.00;
    const grandTotal = Math.round((session.subtotal + shippingCost) * 100) / 100;

    await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        address,
        shippingMethod,
        shippingCost,
        total: grandTotal,
        lastProof: req.headers['x-ash-proof'] as string,
        currentStep: 2,
        status: 'confirmed',
      },
    });

    res.json({
      sessionId,
      address,
      shippingMethod,
      shippingCost,
      grandTotal,
      currency: 'SAR',
      step: 2,
      ash: { verified: true, mode: result.meta?.mode },
    });
  } catch (error: any) {
    console.error('Checkout confirm error:', error);
    const status = error.httpStatus || 500;
    res.status(status).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

// POST /checkout/pay — Unified ASH mode (scope + chain to confirm)
router.post('/checkout/pay', jwtAuth, async (req: Request, res: Response) => {
  try {
    const contextId = req.headers['x-ash-context-id'] as string;
    if (!contextId) {
      res.status(483).json({ error: 'ASH_PROOF_MISSING', message: 'Missing x-ash-context-id header' });
      return;
    }

    const ctx = await ashStore.consume(contextId);
    const body = JSON.stringify(req.body);
    const { sessionId, amount, currency } = req.body;

    if (!sessionId || amount === undefined || !currency) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sessionId, amount, and currency are required' });
      return;
    }

    const session = await prisma.checkoutSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== req.user!.userId) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Checkout session not found' });
      return;
    }

    if (session.currentStep !== 2) {
      res.status(400).json({ error: 'INVALID_STEP', message: 'Session is not at step 2' });
      return;
    }

    const result = ashVerifyRequest({
      headers: req.headers as Record<string, string | string[] | undefined>,
      method: 'POST',
      path: '/checkout/pay',
      body,
      nonce: ctx.nonce,
      contextId: ctx.id,
      scope: ['sessionId', 'amount', 'currency'],
      previousProof: session.lastProof || undefined,
    });

    if (!result.ok) {
      res.status(result.error?.httpStatus || 460).json({
        error: result.error?.code,
        message: result.error?.message,
      });
      return;
    }

    // Verify amount matches the locked session total
    if (Math.abs(amount - session.total) > 0.01) {
      res.status(400).json({
        error: 'AMOUNT_MISMATCH',
        message: `Amount ${amount} does not match session total ${session.total}`,
      });
      return;
    }

    // Mark session as paid
    await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: {
        lastProof: req.headers['x-ash-proof'] as string,
        currentStep: 3,
        status: 'paid',
      },
    });

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: req.user!.userId,
        items: session.items,
        total: session.total,
        currency,
        status: 'completed',
      },
    });

    res.json({
      orderId: order.id,
      total: session.total,
      currency,
      status: 'paid',
      step: 3,
      ash: { verified: true, mode: result.meta?.mode },
    });
  } catch (error: any) {
    console.error('Checkout pay error:', error);
    const status = error.httpStatus || 500;
    res.status(status).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

export default router;
