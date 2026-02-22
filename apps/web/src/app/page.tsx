import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-ash-600">ASH</span> Secure Shop
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          A demo e-commerce app proving that{' '}
          <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">@3maem/ash-node-sdk</code>{' '}
          protects API requests from tampering, forgery, and replay attacks.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/shop" className="bg-ash-600 text-white px-6 py-3 rounded-lg hover:bg-ash-700 transition-colors font-medium">
            Browse Shop
          </Link>
          <Link href="/demo/attacks" className="border-2 border-ash-600 text-ash-600 px-6 py-3 rounded-lg hover:bg-ash-50 transition-colors font-medium">
            See Attack Demo
          </Link>
        </div>
      </section>

      {/* ASH Modes */}
      <section className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="inline-block bg-blue-100 text-blue-800 text-xs font-mono px-2 py-1 rounded-full mb-3">
            BASIC
          </div>
          <h3 className="text-lg font-bold mb-2">Full Payload Integrity</h3>
          <p className="text-gray-600 text-sm mb-3">
            Protects the entire request body. Used for registration and login where every field matters.
          </p>
          <div className="text-xs text-gray-400 font-mono">
            POST /auth/register<br />
            POST /auth/login
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="inline-block bg-purple-100 text-purple-800 text-xs font-mono px-2 py-1 rounded-full mb-3">
            SCOPED
          </div>
          <h3 className="text-lg font-bold mb-2">Field-Level Protection</h3>
          <p className="text-gray-600 text-sm mb-3">
            Protects only sensitive fields (email, phone, role). Non-sensitive fields like bio can change freely.
          </p>
          <div className="text-xs text-gray-400 font-mono">
            PUT /me/profile
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="inline-block bg-green-100 text-green-800 text-xs font-mono px-2 py-1 rounded-full mb-3">
            UNIFIED
          </div>
          <h3 className="text-lg font-bold mb-2">Scoped + Request Chaining</h3>
          <p className="text-gray-600 text-sm mb-3">
            Multi-step checkout where each request is cryptographically linked to the previous one.
          </p>
          <div className="text-xs text-gray-400 font-mono">
            POST /checkout/start<br />
            POST /checkout/confirm<br />
            POST /checkout/pay
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white rounded-xl p-8 shadow-sm border">
        <h2 className="text-2xl font-bold mb-6">How ASH Protects Requests</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Get Context', desc: 'Client requests a nonce and contextId from the server' },
            { step: '2', title: 'Build Proof', desc: 'Client derives HMAC-SHA256 proof over the request body' },
            { step: '3', title: 'Send Request', desc: 'Request sent with 5 x-ash-* headers containing the proof' },
            { step: '4', title: 'Verify', desc: 'Server re-derives and verifies. Context consumed (single-use)' },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 bg-ash-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                {s.step}
              </div>
              <h4 className="font-semibold mb-1">{s.title}</h4>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
