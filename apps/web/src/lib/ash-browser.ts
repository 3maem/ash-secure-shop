/**
 * ash-browser.ts — Browser-compatible ASH client using WebCrypto API
 *
 * Reimplements the core ASH operations (HMAC-SHA256, SHA-256, JCS canonicalization)
 * without any Node.js dependencies, using only crypto.subtle.
 *
 * Must produce byte-identical output to @3maem/ash-node-sdk.
 */

const PIPE = '|';
const SCOPE_DELIMITER = '\x1F'; // U+001F unit separator

// ─── Helpers ──────────────────────────────────────────────────────

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return toHex(hash);
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return toHex(sig);
}

// ─── JCS Canonicalization (RFC 8785) ──────────────────────────────

function canonicalizeValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return '0';
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((v) => canonicalizeValue(v));
    return '[' + items.join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    // Sort by UTF-16 code unit order
    keys.sort((a, b) => {
      const aLen = a.length;
      const bLen = b.length;
      const minLen = Math.min(aLen, bLen);
      for (let i = 0; i < minLen; i++) {
        const diff = a.charCodeAt(i) - b.charCodeAt(i);
        if (diff !== 0) return diff;
      }
      return aLen - bLen;
    });
    const entries = keys
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalizeValue((value as Record<string, unknown>)[k]));
    return '{' + entries.join(',') + '}';
  }
  return String(value);
}

export function ashCanonicalizeJson(input: string): string {
  const parsed = JSON.parse(input);
  return canonicalizeValue(parsed);
}

// ─── Binding Normalization ────────────────────────────────────────

function normalizePath(path: string): string {
  // Remove trailing slashes (except root)
  let p = path.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  // Resolve . and ..
  const segments = p.split('/');
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (resolved.length > 1) resolved.pop();
    } else {
      resolved.push(seg);
    }
  }
  return resolved.join('/') || '/';
}

function canonicalizeQuery(query: string): string {
  if (!query) return '';
  const params = query.split('&').filter(Boolean);
  params.sort();
  return params.join('&');
}

export function ashNormalizeBinding(method: string, path: string, query: string): string {
  const m = method.toUpperCase();
  const p = normalizePath(path);
  const q = canonicalizeQuery(query);
  return `${m}${PIPE}${p}${PIPE}${q}`;
}

// ─── Hashing ──────────────────────────────────────────────────────

export async function ashHashBody(body: string): Promise<string> {
  return sha256(body);
}

export async function ashHashScope(scope: string[]): Promise<string> {
  if (scope.length === 0) return '';
  const sorted = [...new Set(scope)].sort();
  return sha256(sorted.join(SCOPE_DELIMITER));
}

export async function ashHashProof(proof: string): Promise<string> {
  return sha256(proof);
}

// ─── Proof Building ───────────────────────────────────────────────

export async function ashDeriveClientSecret(
  nonce: string,
  contextId: string,
  binding: string,
): Promise<string> {
  const key = nonce.toLowerCase();
  const data = `${contextId}${PIPE}${binding}`;
  return hmacSha256(key, data);
}

export async function ashBuildProof(
  clientSecret: string,
  timestamp: string,
  binding: string,
  bodyHash: string,
): Promise<string> {
  const data = `${timestamp}${PIPE}${binding}${PIPE}${bodyHash}`;
  return hmacSha256(clientSecret, data);
}

export async function ashBuildProofScoped(
  clientSecret: string,
  timestamp: string,
  binding: string,
  bodyHash: string,
  scopeHash: string,
): Promise<string> {
  const data = `${timestamp}${PIPE}${binding}${PIPE}${bodyHash}${PIPE}${scopeHash}`;
  return hmacSha256(clientSecret, data);
}

export async function ashBuildProofUnified(
  clientSecret: string,
  timestamp: string,
  binding: string,
  bodyHash: string,
  scopeHash: string,
  chainHash: string,
): Promise<string> {
  const data = `${timestamp}${PIPE}${binding}${PIPE}${bodyHash}${PIPE}${scopeHash}${PIPE}${chainHash}`;
  return hmacSha256(clientSecret, data);
}

// ─── Scoped Field Extraction ──────────────────────────────────────

function extractField(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function ashExtractScopedFields(payload: unknown, scope: string[]): unknown {
  const result: Record<string, unknown> = {};
  for (const field of scope) {
    const value = extractField(payload, field);
    if (value !== undefined) {
      result[field] = value;
    }
  }
  return result;
}

// ─── High-Level Build Request ─────────────────────────────────────

export interface AshBuildInput {
  nonce: string;
  contextId: string;
  method: string;
  path: string;
  rawQuery?: string;
  body?: string;
  scope?: string[];
  previousProof?: string;
}

export interface AshBuildResult {
  proof: string;
  bodyHash: string;
  binding: string;
  timestamp: string;
  nonce: string;
  contextId: string;
  scopeHash?: string;
  chainHash?: string;
}

export async function ashBrowserBuildRequest(input: AshBuildInput): Promise<AshBuildResult> {
  const { nonce, contextId, method, path, rawQuery, body, scope, previousProof } = input;

  const timestamp = String(Math.floor(Date.now() / 1000));
  const binding = ashNormalizeBinding(method, path, rawQuery || '');

  // Canonicalize body
  let canonical = body || '';
  if (canonical) {
    try {
      canonical = ashCanonicalizeJson(canonical);
    } catch {
      // If not valid JSON, use raw body
    }
  }

  // bodyHash for x-ash-body-hash header = ALWAYS the full canonical body hash
  const bodyHash = await ashHashBody(canonical);
  const clientSecret = await ashDeriveClientSecret(nonce, contextId, binding);

  let proof: string;
  let scopeHash: string | undefined;
  let chainHash: string | undefined;

  if (previousProof || scope) {
    // Unified or Scoped mode
    scopeHash = scope && scope.length > 0 ? await ashHashScope(scope) : '';
    chainHash = previousProof ? await ashHashProof(previousProof) : '';

    // The proof HMAC uses the hash of SCOPED fields (not full body)
    let proofBodyHash: string;
    if (scope && scope.length > 0 && canonical) {
      const parsed = JSON.parse(canonical);
      const scopedFields = ashExtractScopedFields(parsed, scope);
      const canonicalScoped = canonicalizeValue(scopedFields);
      proofBodyHash = await ashHashBody(canonicalScoped);
    } else {
      proofBodyHash = bodyHash;
    }

    if (previousProof) {
      proof = await ashBuildProofUnified(clientSecret, timestamp, binding, proofBodyHash, scopeHash, chainHash);
    } else {
      proof = await ashBuildProofScoped(clientSecret, timestamp, binding, proofBodyHash, scopeHash);
    }
  } else {
    // Basic mode
    proof = await ashBuildProof(clientSecret, timestamp, binding, bodyHash);
  }

  return { proof, bodyHash, binding, timestamp, nonce, contextId, scopeHash, chainHash };
}
