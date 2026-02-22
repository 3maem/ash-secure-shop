import express from 'express';
import cors from 'cors';
import contextRoutes from './routes/context.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import checkoutRoutes from './routes/checkout.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';

const app = express();
const PORT = Number(process.env.API_PORT) || 4000;

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Routes
app.use(contextRoutes);     // GET  /api/context
app.use(authRoutes);        // POST /auth/register, /auth/login
app.use(profileRoutes);     // GET|PUT /me/profile
app.use(checkoutRoutes);    // POST /checkout/start, /confirm, /pay
app.use(productRoutes);     // GET  /api/products
app.use(orderRoutes);       // GET  /api/orders

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`ASH Secure Shop API running on http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /api/context         — Issue ASH context');
  console.log('  POST /auth/register       — Register (Basic ASH)');
  console.log('  POST /auth/login          — Login (Basic ASH)');
  console.log('  GET  /me/profile          — Get profile (JWT)');
  console.log('  PUT  /me/profile          — Update profile (Scoped ASH)');
  console.log('  POST /checkout/start      — Start checkout (Unified ASH)');
  console.log('  POST /checkout/confirm    — Confirm checkout (Unified ASH)');
  console.log('  POST /checkout/pay        — Pay (Unified ASH)');
  console.log('  GET  /api/products        — List products');
  console.log('  GET  /api/orders          — List orders (JWT)');
  console.log('  GET  /health              — Health check');
});
