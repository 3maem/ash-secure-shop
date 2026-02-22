import {
  ashExpressMiddleware,
  AshScopePolicyRegistry,
} from '@3maem/ash-node-sdk';
import { ashStore } from '../lib/context-store.js';

export const scopeRegistry = new AshScopePolicyRegistry();

// Profile: protect sensitive fields only
scopeRegistry.register({
  pattern: 'PUT /me/profile',
  fields: ['email', 'phone', 'role'],
  required: true,
});

// Checkout step 1: protect cart items
scopeRegistry.register({
  pattern: 'POST /checkout/start',
  fields: ['items'],
  required: true,
});

// Checkout step 2: protect session + shipping
scopeRegistry.register({
  pattern: 'POST /checkout/confirm',
  fields: ['sessionId', 'address', 'shippingMethod'],
  required: true,
});

// Checkout step 3: protect session + financials
scopeRegistry.register({
  pattern: 'POST /checkout/pay',
  fields: ['sessionId', 'amount', 'currency'],
  required: true,
});

export const ashMiddleware = ashExpressMiddleware({
  store: ashStore,
  scopeRegistry,
  maxAgeSeconds: 300,
  clockSkewSeconds: 30,
});
