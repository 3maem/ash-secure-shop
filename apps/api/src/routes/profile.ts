import { Router, Request, Response } from 'express';
import { ashMiddleware } from '../middleware/ash.js';
import { jwtAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /me/profile — No ASH (read-only)
router.get('/me/profile', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, bio: true, avatar: true },
    });

    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch profile' });
  }
});

// PUT /me/profile — Scoped ASH mode (protects email, phone, role)
router.put('/me/profile', jwtAuth, ashMiddleware, async (req: Request, res: Response) => {
  try {
    const { email, phone, role, bio, avatar } = req.body;

    const updateData: Record<string, string> = {};
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true, bio: true, avatar: true },
    });

    res.json({
      user,
      ash: (req as any).ash,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update profile' });
  }
});

export default router;
