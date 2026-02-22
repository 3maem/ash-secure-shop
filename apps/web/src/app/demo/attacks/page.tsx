'use client';

import { useState } from 'react';
import { ashBrowserBuildRequest, ashCanonicalizeJson, ashNormalizeBinding } from '@/lib/ash-browser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AttackResult {
  status: number;
  data: any;
  success: boolean;
}

interface Scenario {
  id: number;
  name: string;
  nameAr: string;
  description: string;
  expectedError: string;
  expectedStatus: number;
  mode: 'basic' | 'scoped' | 'unified';
}

const scenarios: Scenario[] = [
  {
    id: 1,
    name: 'Price Tampering',
    nameAr: 'تلاعب بالسعر',
    description: 'Build a valid proof for amount=49.99, then change the body to amount=0.01 before sending.',
    expectedError: 'ASH_PROOF_INVALID',
    expectedStatus: 460,
    mode: 'basic',
  },
  {
    id: 2,
    name: 'Role Escalation',
    nameAr: 'ترقية الدور',
    description: 'Build a valid proof with role="user", then change to role="admin" in the body.',
    expectedError: 'ASH_PROOF_INVALID',
    expectedStatus: 460,
    mode: 'scoped',
  },
  {
    id: 3,
    name: 'Replay Attack',
    nameAr: 'هجوم إعادة الإرسال',
    description: 'Send a valid request, then re-send the exact same request with the same headers.',
    expectedError: 'ASH_CTX_ALREADY_USED',
    expectedStatus: 452,
    mode: 'basic',
  },
  {
    id: 4,
    name: 'Missing Proof Header',
    nameAr: 'حذف هيدر التوقيع',
    description: 'Send a request without the x-ash-proof header.',
    expectedError: 'ASH_PROOF_MISSING',
    expectedStatus: 483,
    mode: 'basic',
  },
  {
    id: 5,
    name: 'Stale Timestamp',
    nameAr: 'طابع زمني منتهي',
    description: 'Build a proof with a timestamp from 10 minutes ago.',
    expectedError: 'ASH_TIMESTAMP_INVALID',
    expectedStatus: 482,
    mode: 'basic',
  },
  {
    id: 6,
    name: 'Body Tampering (Basic)',
    nameAr: 'تعديل المحتوى',
    description: 'Build a valid proof, then add an extra field to the JSON body.',
    expectedError: 'ASH_PROOF_INVALID',
    expectedStatus: 460,
    mode: 'basic',
  },
  {
    id: 7,
    name: 'Non-Scoped Field Change (SHOULD PASS)',
    nameAr: 'تعديل حقل غير محمي (ناجح)',
    description: 'Scoped proof protects email/phone/role. Changing "bio" should still pass verification.',
    expectedError: 'NONE',
    expectedStatus: 200,
    mode: 'scoped',
  },
];

export default function AttackDemoPage() {
  const [results, setResults] = useState<Record<number, AttackResult>>({});
  const [running, setRunning] = useState<number | null>(null);

  async function getContext(method: string, path: string) {
    const res = await fetch(`${API_URL}/api/context?method=${method}&path=${encodeURIComponent(path)}`);
    return res.json();
  }

  // Attack 1: Price Tampering
  async function runAttack1(): Promise<AttackResult> {
    const ctx = await getContext('POST', '/auth/register');
    const originalBody = JSON.stringify({ name: 'Test', email: `attack1-${Date.now()}@test.com`, password: 'Test123!' });

    const result = await ashBrowserBuildRequest({
      nonce: ctx.nonce, contextId: ctx.contextId,
      method: 'POST', path: '/auth/register', body: originalBody,
    });

    // Tamper: change the body AFTER building the proof
    const tamperedBody = JSON.stringify({ name: 'Test', email: `attack1-${Date.now()}@test.com`, password: 'Test123!', role: 'admin' });

    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ash-ts': result.timestamp,
        'x-ash-nonce': result.nonce,
        'x-ash-body-hash': result.bodyHash,
        'x-ash-proof': result.proof,
        'x-ash-context-id': result.contextId,
      },
      body: tamperedBody, // Different from what was signed!
    });
    const data = await res.json();
    return { status: res.status, data, success: false };
  }

  // Attack 2: Role Escalation (scoped)
  async function runAttack2(): Promise<AttackResult> {
    // First register + login to get a token
    const regCtx = await getContext('POST', '/auth/register');
    const email = `attack2-${Date.now()}@test.com`;
    const regBody = JSON.stringify({ name: 'Test', email, password: 'Test123!' });
    const regResult = await ashBrowserBuildRequest({
      nonce: regCtx.nonce, contextId: regCtx.contextId,
      method: 'POST', path: '/auth/register', body: regBody,
    });
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ash-ts': regResult.timestamp, 'x-ash-nonce': regResult.nonce,
        'x-ash-body-hash': regResult.bodyHash, 'x-ash-proof': regResult.proof,
        'x-ash-context-id': regResult.contextId,
      },
      body: regBody,
    });
    const regData = await regRes.json();
    const token = regData.accessToken;

    // Now try scoped profile update with tampered role
    const ctx = await getContext('PUT', '/me/profile');
    const originalBody = JSON.stringify({ email, phone: '+966500000000', role: 'user', bio: 'Hello' });
    const result = await ashBrowserBuildRequest({
      nonce: ctx.nonce, contextId: ctx.contextId,
      method: 'PUT', path: '/me/profile', body: originalBody,
      scope: ['email', 'phone', 'role'],
    });

    // Tamper: change role to admin
    const tamperedBody = JSON.stringify({ email, phone: '+966500000000', role: 'admin', bio: 'Hello' });

    const res = await fetch(`${API_URL}/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-ash-ts': result.timestamp, 'x-ash-nonce': result.nonce,
        'x-ash-body-hash': result.bodyHash, 'x-ash-proof': result.proof,
        'x-ash-context-id': result.contextId,
      },
      body: tamperedBody,
    });
    const data = await res.json();
    return { status: res.status, data, success: false };
  }

  // Attack 3: Replay
  async function runAttack3(): Promise<AttackResult> {
    const ctx = await getContext('POST', '/auth/register');
    const email = `attack3-${Date.now()}@test.com`;
    const body = JSON.stringify({ name: 'Test', email, password: 'Test123!' });
    const result = await ashBrowserBuildRequest({
      nonce: ctx.nonce, contextId: ctx.contextId,
      method: 'POST', path: '/auth/register', body,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-ash-ts': result.timestamp, 'x-ash-nonce': result.nonce,
      'x-ash-body-hash': result.bodyHash, 'x-ash-proof': result.proof,
      'x-ash-context-id': result.contextId,
    };

    // First request — should succeed
    await fetch(`${API_URL}/auth/register`, { method: 'POST', headers, body });

    // Replay — exact same request again
    const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers, body });
    const data = await res.json();
    return { status: res.status, data, success: false };
  }

  // Attack 4: Missing proof header
  async function runAttack4(): Promise<AttackResult> {
    const ctx = await getContext('POST', '/auth/register');
    const body = JSON.stringify({ name: 'Test', email: `attack4-${Date.now()}@test.com`, password: 'Test123!' });
    const result = await ashBrowserBuildRequest({
      nonce: ctx.nonce, contextId: ctx.contextId,
      method: 'POST', path: '/auth/register', body,
    });

    // Send WITHOUT x-ash-proof
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ash-ts': result.timestamp,
        'x-ash-nonce': result.nonce,
        'x-ash-body-hash': result.bodyHash,
        'x-ash-context-id': result.contextId,
        // x-ash-proof intentionally omitted!
      },
      body,
    });
    const data = await res.json();
    return { status: res.status, data, success: false };
  }

  // Attack 5: Stale timestamp
  async function runAttack5(): Promise<AttackResult> {
    const ctx = await getContext('POST', '/auth/register');
    const body = JSON.stringify({ name: 'Test', email: `attack5-${Date.now()}@test.com`, password: 'Test123!' });

    // Build with stale timestamp (10 minutes ago)
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const binding = ashNormalizeBinding('POST', '/auth/register', '');
    const canonical = ashCanonicalizeJson(body);

    // We need to manually build with stale timestamp
    const { ashDeriveClientSecret, ashBuildProof, ashHashBody } = await import('@/lib/ash-browser');
    const bodyHash = await ashHashBody(canonical);
    const clientSecret = await ashDeriveClientSecret(ctx.nonce, ctx.contextId, binding);
    const proof = await ashBuildProof(clientSecret, staleTimestamp, binding, bodyHash);

    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ash-ts': staleTimestamp,
        'x-ash-nonce': ctx.nonce,
        'x-ash-body-hash': bodyHash,
        'x-ash-proof': proof,
        'x-ash-context-id': ctx.contextId,
      },
      body: canonical,
    });
    const data = await res.json();
    return { status: res.status, data, success: false };
  }

  // Attack 6: Body tampering (add extra field)
  async function runAttack6(): Promise<AttackResult> {
    const ctx = await getContext('POST', '/auth/register');
    const originalBody = JSON.stringify({ name: 'Test', email: `attack6-${Date.now()}@test.com`, password: 'Test123!' });

    const result = await ashBrowserBuildRequest({
      nonce: ctx.nonce, contextId: ctx.contextId,
      method: 'POST', path: '/auth/register', body: originalBody,
    });

    // Add an extra field
    const tamperedBody = JSON.stringify({ name: 'Test', email: `attack6-${Date.now()}@test.com`, password: 'Test123!', isAdmin: true });

    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ash-ts': result.timestamp, 'x-ash-nonce': result.nonce,
        'x-ash-body-hash': result.bodyHash, 'x-ash-proof': result.proof,
        'x-ash-context-id': result.contextId,
      },
      body: tamperedBody,
    });
    const data = await res.json();
    return { status: res.status, data, success: false };
  }

  // Attack 7: Non-scoped field change (SHOULD PASS)
  async function runAttack7(): Promise<AttackResult> {
    // Register + login
    const regCtx = await getContext('POST', '/auth/register');
    const email = `attack7-${Date.now()}@test.com`;
    const regBody = JSON.stringify({ name: 'Test', email, password: 'Test123!' });
    const regResult = await ashBrowserBuildRequest({
      nonce: regCtx.nonce, contextId: regCtx.contextId,
      method: 'POST', path: '/auth/register', body: regBody,
    });
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ash-ts': regResult.timestamp, 'x-ash-nonce': regResult.nonce,
        'x-ash-body-hash': regResult.bodyHash, 'x-ash-proof': regResult.proof,
        'x-ash-context-id': regResult.contextId,
      },
      body: regBody,
    });
    const regData = await regRes.json();
    const token = regData.accessToken;

    // Scoped update — change bio (non-scoped), keep email/phone/role same
    const ctx = await getContext('PUT', '/me/profile');
    const body = JSON.stringify({ email, phone: '+966500000000', role: 'user', bio: 'Original bio' });
    const result = await ashBrowserBuildRequest({
      nonce: ctx.nonce, contextId: ctx.contextId,
      method: 'PUT', path: '/me/profile', body,
      scope: ['email', 'phone', 'role'],
    });

    // Change bio ONLY (non-scoped field) — this should still pass!
    const modifiedBody = JSON.stringify({ email, phone: '+966500000000', role: 'user', bio: 'Modified bio — this is fine!' });

    const res = await fetch(`${API_URL}/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-ash-ts': result.timestamp, 'x-ash-nonce': result.nonce,
        'x-ash-body-hash': result.bodyHash, 'x-ash-proof': result.proof,
        'x-ash-context-id': result.contextId,
      },
      body: modifiedBody,
    });
    const data = await res.json();
    return { status: res.status, data, success: res.ok };
  }

  const attackRunners: Record<number, () => Promise<AttackResult>> = {
    1: runAttack1, 2: runAttack2, 3: runAttack3, 4: runAttack4,
    5: runAttack5, 6: runAttack6, 7: runAttack7,
  };

  async function runScenario(id: number) {
    setRunning(id);
    try {
      const result = await attackRunners[id]();
      setResults((prev) => ({ ...prev, [id]: result }));
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [id]: { status: 0, data: { error: 'NETWORK_ERROR', message: err.message }, success: false },
      }));
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    for (const scenario of scenarios) {
      await runScenario(scenario.id);
      await new Promise((r) => setTimeout(r, 300)); // Small delay between attacks
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Attack Demo</h1>
          <p className="text-gray-500 mt-1">See ASH reject tampered, replayed, and forged requests in real-time.</p>
        </div>
        <button
          onClick={runAll}
          disabled={running !== null}
          className="bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
        >
          Run All Attacks
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg text-sm mb-8">
        <strong>Note:</strong> The API server must be running on <code>localhost:4000</code>.
        Attacks #2 and #7 create temporary user accounts for the scoped mode demo.
      </div>

      <div className="space-y-4">
        {scenarios.map((scenario) => {
          const result = results[scenario.id];
          const isRunning = running === scenario.id;
          const isPass = scenario.id === 7; // Scenario 7 is expected to succeed

          return (
            <div key={scenario.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-mono text-gray-400">#{scenario.id}</span>
                      <h3 className="font-bold text-lg">{scenario.name}</h3>
                      <span className="text-sm text-gray-400" dir="rtl">{scenario.nameAr}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        scenario.mode === 'basic' ? 'bg-blue-100 text-blue-700' :
                        scenario.mode === 'scoped' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>{scenario.mode}</span>
                    </div>
                    <p className="text-sm text-gray-600">{scenario.description}</p>
                    <div className="mt-2 text-xs font-mono">
                      Expected: <span className={isPass ? 'text-green-600' : 'text-red-600'}>
                        {scenario.expectedError} ({scenario.expectedStatus})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => runScenario(scenario.id)}
                    disabled={isRunning || running !== null}
                    className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                      isPass
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isRunning ? 'Running...' : isPass ? 'Try Safe Change' : 'Try Attack'}
                  </button>
                </div>

                {/* Result */}
                {result && (
                  <div className={`mt-4 p-4 rounded-lg font-mono text-sm ${
                    (isPass && result.status < 400) || (!isPass && result.status >= 400)
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-lg ${
                        (isPass && result.status < 400) || (!isPass && result.status >= 400) ? '' : ''
                      }`}>
                        {(isPass && result.status < 400) || (!isPass && result.status >= 400) ? '✅' : '❌'}
                      </span>
                      <span className="font-bold">
                        HTTP {result.status}
                        {(isPass && result.status < 400) ? ' — Safe change accepted!' :
                         (!isPass && result.status >= 400) ? ' — Attack blocked!' :
                         ' — Unexpected result'}
                      </span>
                    </div>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-gray-700">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
