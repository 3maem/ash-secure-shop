'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';

export default function CartPage() {
  const { items, removeItem, updateQty, total, count } = useCart();
  const { isAuthenticated } = useAuth();

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-6">Add some products from the shop.</p>
        <Link href="/shop" className="bg-ash-600 text-white px-6 py-3 rounded-lg hover:bg-ash-700 transition-colors">
          Browse Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Shopping Cart ({count} items)</h1>

      <div className="bg-white rounded-xl shadow-sm border divide-y">
        {items.map((item) => (
          <div key={item.productId} className="p-4 flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-ash-700 font-bold">{item.price.toFixed(2)} SAR</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateQty(item.productId, item.qty - 1)}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-50"
              >
                -
              </button>
              <span className="w-8 text-center font-medium">{item.qty}</span>
              <button
                onClick={() => updateQty(item.productId, item.qty + 1)}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-50"
              >
                +
              </button>
              <button
                onClick={() => removeItem(item.productId)}
                className="text-red-500 text-sm ml-4 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between text-lg font-bold mb-4">
          <span>Total</span>
          <span className="text-ash-700">{total.toFixed(2)} SAR</span>
        </div>

        {isAuthenticated ? (
          <Link
            href="/checkout"
            className="block text-center bg-ash-600 text-white py-3 rounded-lg hover:bg-ash-700 transition-colors font-medium"
          >
            Proceed to Checkout (ASH Unified Mode)
          </Link>
        ) : (
          <Link
            href="/login"
            className="block text-center bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Login to Checkout
          </Link>
        )}
      </div>
    </div>
  );
}
