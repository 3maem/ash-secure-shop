import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/products — Public, no ASH
router.get('/api/products', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ products });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch products' });
  }
});

// GET /api/products/:id — Public, no ASH
router.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Product not found' });
      return;
    }
    res.json({ product });
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch product' });
  }
});

export default router;
