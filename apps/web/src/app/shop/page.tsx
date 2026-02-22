'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/cart-context';
import { apiFetch } from '@/lib/ash-fetch';

interface Product {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  price: number;
  image: string | null;
  stock: number;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const { addItem } = useCart();

  const handleAdd = (product: Product) => {
    addItem({ productId: product.id, name: product.name, price: product.price });
    setToast(product.name);
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    apiFetch('/api/products')
      .then((data) => setProducts(data.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading products...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Shop</h1>
      <p className="text-gray-500 mb-8">Browse products. No ASH protection needed for read-only endpoints.</p>

      <div className="grid md:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
            <div className="w-full h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center text-4xl">
              {product.name.includes('Headphones') ? '🎧' :
               product.name.includes('Keyboard') ? '⌨️' :
               product.name.includes('USB') ? '🔌' :
               product.name.includes('Webcam') ? '📷' :
               product.name.includes('Mouse') ? '🖱️' :
               product.name.includes('Phone') ? '📱' : '📦'}
            </div>
            <h3 className="font-bold text-lg">{product.name}</h3>
            {product.nameAr && (
              <p className="text-gray-500 text-sm" dir="rtl">{product.nameAr}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">{product.description}</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-2xl font-bold text-ash-700">{product.price.toFixed(2)} SAR</span>
              <button
                onClick={() => handleAdd(product)}
                className="bg-ash-600 text-white px-4 py-2 rounded-lg hover:bg-ash-700 transition-colors text-sm font-medium"
              >
                Add to Cart
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">{product.stock} in stock</p>
          </div>
        ))}
      </div>
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-ash-900 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <span className="text-green-400">&#10003;</span>
          <span><strong>{toast}</strong> added to cart</span>
        </div>
      )}
    </div>
  );
}
