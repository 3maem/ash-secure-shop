'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/ash-fetch';

interface Order {
  id: string;
  items: { productId: string; qty: number; price: number }[];
  total: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const { token, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/orders', { token })
      .then((data) => setOrders(data.orders || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (!isAuthenticated) {
    return <div className="text-center py-16 text-gray-500">Please login to view your orders.</div>;
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">No Orders Yet</h1>
        <p className="text-gray-500">Complete a checkout to see your orders here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs text-gray-400 font-mono">Order #{order.id.slice(0, 8)}</span>
                <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                {order.status}
              </span>
            </div>
            <div className="divide-y text-sm">
              {order.items.map((item, i) => (
                <div key={i} className="py-1 flex justify-between">
                  <span>{item.productId} x{item.qty}</span>
                  <span>{(item.price * item.qty).toFixed(2)} {order.currency}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold mt-3 pt-3 border-t">
              <span>Total</span>
              <span>{order.total.toFixed(2)} {order.currency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
