import { Router, Request, Response } from 'express';
import { jwtAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/orders — Protected by JWT only (read-only, no ASH)
router.get('/api/orders', jwtAuth, async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = orders.map(o => ({
      ...o,
      items: JSON.parse(o.items),
    }));

    res.json({ orders: parsed });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch orders' });
  }
});

export default router;
