import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { ashMiddleware } from '../middleware/ash.js';
import { signToken, signRefreshToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// POST /auth/register — Basic ASH mode
router.post('/auth/register', ashMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'name, email, and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
      ash: (req as any).ash,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Registration failed' });
  }
});

// POST /auth/login — Basic ASH mode
router.post('/auth/login', ashMiddleware, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
      return;
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
      ash: (req as any).ash,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Login failed' });
  }
});

export default router;
