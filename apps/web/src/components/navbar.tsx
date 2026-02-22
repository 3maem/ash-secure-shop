'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { useToast } from '@/lib/toast-context';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { count } = useCart();
  const { showToast } = useToast();

  const handleLogout = () => {
    logout();
    showToast('You have been logged out');
  };

  return (
    <nav className="bg-ash-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-ash-300">ASH</span>
          <span>Secure Shop</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/shop" className="hover:text-ash-300 transition-colors">
            Shop
          </Link>

          <Link href="/cart" className="hover:text-ash-300 transition-colors relative">
            Cart
            {count > 0 && (
              <span className="absolute -top-2 -right-4 bg-ash-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>

          <Link href="/demo/attacks" className="hover:text-ash-300 transition-colors text-sm border border-ash-600 px-2 py-1 rounded">
            Attack Demo
          </Link>

          {isAuthenticated ? (
            <>
              <Link href="/profile" className="hover:text-ash-300 transition-colors">
                {user?.name}
              </Link>
              <Link href="/orders" className="hover:text-ash-300 transition-colors">
                Orders
              </Link>
              <button onClick={handleLogout} className="text-sm text-ash-400 hover:text-white transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-ash-300 transition-colors">
                Login
              </Link>
              <Link href="/register" className="bg-ash-600 hover:bg-ash-500 px-3 py-1.5 rounded text-sm transition-colors">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
