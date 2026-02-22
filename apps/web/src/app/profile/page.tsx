'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ashFetch, apiFetch } from '@/lib/ash-fetch';
import { AshBadge } from '@/components/ash-badge';

export default function ProfilePage() {
  const { token, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ashInfo, setAshInfo] = useState<any>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (!token) return;
    apiFetch('/me/profile', { token })
      .then((data) => {
        setProfile(data.user);
        setEmail(data.user.email || '');
        setPhone(data.user.phone || '');
        setBio(data.user.bio || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data, response } = await ashFetch('/me/profile', {
        method: 'PUT',
        body: { email, phone, role: profile.role, bio },
        scope: ['email', 'phone', 'role'],
        token: token!,
      });

      if (!response.ok) {
        setError(data.message || 'Update failed');
        return;
      }

      setProfile(data.user);
      setAshInfo(data.ash);
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="text-center py-16 text-gray-500">Please login to view your profile.</div>;
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading profile...</div>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl p-8 shadow-sm border">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <AshBadge mode="scoped" verified={ashInfo?.verified} />
        </div>

        <div className="bg-purple-50 border border-purple-200 text-purple-800 p-3 rounded-lg text-sm mb-6">
          <strong>ASH Scoped Mode</strong> — Only <code>email</code>, <code>phone</code>, and <code>role</code> are
          integrity-protected. You can change <code>bio</code> freely without breaking the proof.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4 text-sm">{success}</div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name <span className="text-gray-400">(read-only)</span>
            </label>
            <input value={profile?.name || ''} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email <span className="text-purple-600 text-xs">SCOPED</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone <span className="text-purple-600 text-xs">SCOPED</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966501234567"
              className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Role <span className="text-purple-600 text-xs">SCOPED</span> <span className="text-gray-400">(read-only)</span>
            </label>
            <input value={profile?.role || 'user'} disabled className="w-full border-2 border-purple-200 rounded-lg px-3 py-2 bg-purple-50 text-gray-500" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Bio <span className="text-gray-400 text-xs">NOT SCOPED — can change freely</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell us about yourself..."
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ash-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-ash-600 text-white py-2.5 rounded-lg hover:bg-ash-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
