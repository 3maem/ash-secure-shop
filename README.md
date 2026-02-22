# ASH Secure Shop

> Last updated: 2026-02-22

A full-stack demo app proving that [`@3maem/ash-node-sdk`](https://www.npmjs.com/package/@3maem/ash-node-sdk) protects real API endpoints against payload tampering, request forgery, replay attacks, and step-skipping.

## What is ASH?

**ASH (Application Security Hash)** is a request integrity protocol. It sits between HTTPS and application auth, providing HMAC-SHA256 cryptographic proofs that each HTTP request is authentic, unmodified, single-use, and endpoint-bound.

- [ASH GitHub Repository](https://github.com/3maem/ashcore)
- [ASH npm Package](https://www.npmjs.com/package/@3maem/ash-node-sdk)

## Quick Start

```bash
# 1. Clone
git clone https://github.com/3maem/ash-secure-shop.git
cd ash-secure-shop

# 2. Install all dependencies
npm install

# 3. Setup database (SQLite — no external DB needed)
cd apps/api
cp .env.example .env    # or create .env with contents below
npx prisma migrate dev --name init
npx tsx prisma/seed.ts
cd ../..

# 4. Start both API + frontend
npm run dev
```

The API runs on `http://localhost:4000`, the frontend on `http://localhost:3000`.

### `.env` (apps/api/.env)

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret-change-in-production"
API_PORT=4000
```

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Browser (Next.js) │         │  Express API :4000   │
│                     │         │                      │
│  ash-browser.ts     │ ──────> │  @3maem/ash-node-sdk │
│  (WebCrypto API)    │         │  (ashExpressMiddleware)│
│                     │         │                      │
│  1. GET /api/context│ ──────> │  Generate nonce      │
│  2. Build proof     │         │  Store context       │
│  3. Send + headers  │ ──────> │  Verify proof        │
│                     │         │  Consume context     │
└─────────────────────┘         └──────────┬───────────┘
                                           │
                                    ┌──────┴──────┐
                                    │ SQLite (DB) │
                                    │ Prisma ORM  │
                                    └─────────────┘
```

**Key insight:** The npm SDK uses `node:crypto` and can't run in browsers. This demo includes a browser-compatible ASH client (`ash-browser.ts`) that reimplements core operations using the WebCrypto API (`crypto.subtle`).

## ASH Protection Modes

### Basic Mode — Auth Routes

Protects the **entire** request body. If any field is tampered, the proof breaks.

| Route | Protection |
|-------|-----------|
| `POST /auth/register` | Full body integrity |
| `POST /auth/login` | Full body integrity |

### Scoped Mode — Profile

Protects **only sensitive fields** (`email`, `phone`, `role`). Non-sensitive fields like `bio` can change freely without breaking the proof.

| Route | Scoped Fields |
|-------|--------------|
| `PUT /me/profile` | `email`, `phone`, `role` |

### Unified Mode — Checkout (Scoped + Chaining)

Multi-step checkout where each request is **cryptographically linked** to the previous one via `previousProof`. Prevents step-skipping, price tampering, and replay within the flow.

| Step | Route | Scope | Chain |
|------|-------|-------|-------|
| 1 | `POST /checkout/start` | `items` | First link |
| 2 | `POST /checkout/confirm` | `sessionId, address, shippingMethod` | Chains to step 1 |
| 3 | `POST /checkout/pay` | `sessionId, amount, currency` | Chains to step 2 |

## Attack Demo

Visit `http://localhost:3000/demo/attacks` to see ASH **reject** attacks in real-time:

| # | Attack | Expected Result |
|---|--------|----------------|
| 1 | Price Tampering | `ASH_PROOF_INVALID` (460) |
| 2 | Role Escalation | `ASH_PROOF_INVALID` (460) |
| 3 | Replay Attack | `ASH_CTX_ALREADY_USED` (452) |
| 4 | Missing Proof Header | `ASH_PROOF_MISSING` (483) |
| 5 | Stale Timestamp | `ASH_TIMESTAMP_INVALID` (482) |
| 6 | Body Tampering | `ASH_PROOF_INVALID` (460) |
| 7 | Non-Scoped Field Change | **PASS** (200) — proves scoped mode works |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Express 4 + TypeScript |
| Database | SQLite via Prisma |
| Auth | JWT (access + refresh tokens) |
| ASH | `@3maem/ash-node-sdk` (from npm) |
| Browser Crypto | WebCrypto API (`crypto.subtle`) |

## API Reference

| Method | Path | ASH Mode | Auth |
|--------|------|----------|------|
| `GET` | `/api/context` | None | No |
| `POST` | `/auth/register` | Basic | No |
| `POST` | `/auth/login` | Basic | No |
| `GET` | `/me/profile` | None | JWT |
| `PUT` | `/me/profile` | Scoped | JWT |
| `POST` | `/checkout/start` | Unified | JWT |
| `POST` | `/checkout/confirm` | Unified | JWT |
| `POST` | `/checkout/pay` | Unified | JWT |
| `GET` | `/api/products` | None | No |
| `GET` | `/api/orders` | None | JWT |
| `GET` | `/health` | None | No |

## Project Structure

```
ash-secure-shop/
├── apps/
│   ├── api/                        # Express backend
│   │   ├── src/
│   │   │   ├── server.ts           # Express app entry
│   │   │   ├── routes/
│   │   │   │   ├── context.ts      # ASH context issuer
│   │   │   │   ├── auth.ts         # Register + login (Basic)
│   │   │   │   ├── profile.ts      # Profile CRUD (Scoped)
│   │   │   │   ├── checkout.ts     # 3-step checkout (Unified)
│   │   │   │   ├── products.ts     # Product listing
│   │   │   │   └── orders.ts       # Order history
│   │   │   ├── middleware/
│   │   │   │   ├── ash.ts          # ASH middleware + scope registry
│   │   │   │   └── auth.ts         # JWT middleware
│   │   │   └── lib/
│   │   │       ├── context-store.ts # AshMemoryStore instance
│   │   │       └── prisma.ts       # Prisma client
│   │   └── prisma/
│   │       ├── schema.prisma       # DB schema
│   │       └── seed.ts             # Product seed data
│   └── web/                        # Next.js frontend
│       └── src/
│           ├── app/                # Pages (App Router)
│           ├── components/         # UI components
│           └── lib/
│               ├── ash-browser.ts  # Browser ASH client (WebCrypto)
│               ├── ash-fetch.ts    # ASH-aware fetch wrapper
│               ├── auth-context.tsx # Auth state
│               └── cart-context.tsx # Cart state
├── package.json                    # npm workspaces root
└── README.md
```

## License

Apache-2.0
