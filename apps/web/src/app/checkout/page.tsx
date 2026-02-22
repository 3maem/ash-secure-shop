'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { ashFetch } from '@/lib/ash-fetch';
import { AshBadge } from '@/components/ash-badge';

type Step = 'start' | 'confirm' | 'pay' | 'done';

export default function CheckoutPage() {
  const { token } = useAuth();
  const { items, total, clearCart } = useCart();
  const router = useRouter();

  const [step, setStep] = useState<Step>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Chain state
  const [sessionId, setSessionId] = useState('');
  const [lastProof, setLastProof] = useState('');
  const [serverTotal, setServerTotal] = useState(0);
  const [ashModes, setAshModes] = useState<Record<string, any>>({});

  // Form state
  const [address, setAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [grandTotal, setGrandTotal] = useState(0);

  if (items.length === 0 && step !== 'done') {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Cart is empty</h1>
        <button onClick={() => router.push('/shop')} className="text-ash-600 hover:underline">
          Go to shop
        </button>
      </div>
    );
  }

  // Step 1: Start checkout
  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const cartItems = items.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price }));

      const { data, response, proof } = await ashFetch('/checkout/start', {
        method: 'POST',
        body: { items: cartItems },
        scope: ['items'],
        token: token!,
      });

      if (!response.ok) {
        setError(data.message || 'Checkout start failed');
        return;
      }

      setSessionId(data.sessionId);
      setServerTotal(data.total);
      setLastProof(proof);
      setAshModes((prev) => ({ ...prev, start: data.ash }));
      setStep('confirm');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm shipping
  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, response, proof } = await ashFetch('/checkout/confirm', {
        method: 'POST',
        body: { sessionId, address, shippingMethod },
        scope: ['sessionId', 'address', 'shippingMethod'],
        previousProof: lastProof,
        token: token!,
      });

      if (!response.ok) {
        setError(data.message || 'Checkout confirm failed');
        return;
      }

      setGrandTotal(data.grandTotal);
      setLastProof(proof);
      setAshModes((prev) => ({ ...prev, confirm: data.ash }));
      setStep('pay');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Pay
  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, response, proof } = await ashFetch('/checkout/pay', {
        method: 'POST',
        body: { sessionId, amount: grandTotal, currency: 'SAR', paymentMethod: 'card', cardLast4: '4242' },
        scope: ['sessionId', 'amount', 'currency'],
        previousProof: lastProof,
        token: token!,
      });

      if (!response.ok) {
        setError(data.message || 'Payment failed');
        return;
      }

      setAshModes((prev) => ({ ...prev, pay: data.ash }));
      clearCart();
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <AshBadge mode="unified" verified={step !== 'start'} />
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {['start', 'confirm', 'pay', 'done'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-ash-600 text-white' :
              ['start', 'confirm', 'pay', 'done'].indexOf(step) > i ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {['start', 'confirm', 'pay', 'done'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            {i < 3 && <div className={`w-12 h-0.5 ${['start', 'confirm', 'pay', 'done'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Step 1: Review cart */}
      {step === 'start' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold mb-4">Step 1: Review Items</h2>
          <p className="text-sm text-gray-500 mb-4">
            ASH Unified Mode — scope: <code className="bg-gray-100 px-1 rounded">items</code>. This is the first link in the chain.
          </p>
          <div className="divide-y mb-4">
            {items.map((item) => (
              <div key={item.productId} className="py-2 flex justify-between">
                <span>{item.name} x{item.qty}</span>
                <span className="font-bold">{(item.price * item.qty).toFixed(2)} SAR</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-3">
            <span>Total</span>
            <span>{total.toFixed(2)} SAR</span>
          </div>
          <button onClick={handleStart} disabled={loading} className="w-full mt-4 bg-ash-600 text-white py-3 rounded-lg hover:bg-ash-700 disabled:opacity-50 font-medium">
            {loading ? 'Starting checkout...' : 'Start Checkout'}
          </button>
        </div>
      )}

      {/* Step 2: Shipping */}
      {step === 'confirm' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold mb-4">Step 2: Shipping Details</h2>
          <p className="text-sm text-gray-500 mb-4">
            ASH Unified Mode — scope: <code className="bg-gray-100 px-1 rounded">sessionId, address, shippingMethod</code>.
            Chained to Step 1 via <code className="bg-gray-100 px-1 rounded">previousProof</code>.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Shipping Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 King Abdulaziz St, Riyadh"
                required
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ash-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Shipping Method</label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ash-500"
              >
                <option value="standard">Standard (10.00 SAR)</option>
                <option value="express">Express (25.00 SAR)</option>
              </select>
            </div>
          </div>
          <button onClick={handleConfirm} disabled={loading || !address} className="w-full mt-4 bg-ash-600 text-white py-3 rounded-lg hover:bg-ash-700 disabled:opacity-50 font-medium">
            {loading ? 'Confirming...' : 'Confirm Shipping'}
          </button>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 'pay' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold mb-4">Step 3: Payment</h2>
          <p className="text-sm text-gray-500 mb-4">
            ASH Unified Mode — scope: <code className="bg-gray-100 px-1 rounded">sessionId, amount, currency</code>.
            Chained to Step 2. Amount is locked at the server-verified total.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Subtotal</span>
              <span>{serverTotal.toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Shipping</span>
              <span>{(grandTotal - serverTotal).toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Grand Total</span>
              <span className="text-ash-700">{grandTotal.toFixed(2)} SAR</span>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm mb-4">
            Simulated payment — no real charges will be made.
          </div>
          <button onClick={handlePay} disabled={loading} className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
            {loading ? 'Processing payment...' : `Pay ${grandTotal.toFixed(2)} SAR`}
          </button>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="bg-white rounded-xl p-8 shadow-sm border text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Order Complete!</h2>
          <p className="text-gray-500 mb-6">
            All 3 steps were verified with ASH Unified Mode (scoped + chained).
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm font-mono space-y-1 mb-6">
            <div>Step 1 (start): {ashModes.start?.mode || 'unified'} ✓</div>
            <div>Step 2 (confirm): {ashModes.confirm?.mode || 'unified'} ✓ chained</div>
            <div>Step 3 (pay): {ashModes.pay?.mode || 'unified'} ✓ chained</div>
          </div>
          <div className="flex gap-4 justify-center">
            <button onClick={() => router.push('/orders')} className="bg-ash-600 text-white px-6 py-2 rounded-lg hover:bg-ash-700">
              View Orders
            </button>
            <button onClick={() => router.push('/shop')} className="border border-ash-600 text-ash-600 px-6 py-2 rounded-lg hover:bg-ash-50">
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
