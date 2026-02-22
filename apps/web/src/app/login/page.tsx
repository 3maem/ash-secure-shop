'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ashFetch } from '@/lib/ash-fetch';
import { AshBadge } from '@/components/ash-badge';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ashInfo, setAshInfo] = useState<any>(null);
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, response } = await ashFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      if (!response.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      setAshInfo(data.ash);
      login(data.user, data.accessToken, data.refreshToken);
      showToast(`Welcome back, ${data.user.name}!`);
      setTimeout(() => router.push('/shop'), 1000);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl p-8 shadow-sm border">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Login</h1>
          <AshBadge mode="basic" verified={ashInfo?.verified} />
        </div>

        <p className="text-sm text-gray-500 mb-6">
          This form is protected by <strong>ASH Basic Mode</strong> — full payload integrity verification.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ash-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ash-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ash-600 text-white py-2.5 rounded-lg hover:bg-ash-700 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account? <Link href="/register" className="text-ash-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
