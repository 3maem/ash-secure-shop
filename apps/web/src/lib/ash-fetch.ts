/**
 * ash-fetch.ts — ASH-aware fetch wrapper
 *
 * Handles the two-step ASH flow:
 *   1. Get context (nonce + contextId) from the server
 *   2. Build proof in the browser using WebCrypto
 *   3. Send the request with all 5 ASH headers
 */

import {
  ashBrowserBuildRequest,
  ashCanonicalizeJson,
  type AshBuildResult,
} from './ash-browser';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AshFetchOptions {
  method: string;
  body?: unknown;
  scope?: string[];
  previousProof?: string;
  token?: string;
}

interface AshFetchResult {
  response: Response;
  data: any;
  proof: string;
  ashResult: AshBuildResult;
}

export async function ashFetch(
  path: string,
  options: AshFetchOptions,
): Promise<AshFetchResult> {
  const { method, body, scope, previousProof, token } = options;

  // 1. Get ASH context from the server
  const contextUrl = `${API_URL}/api/context?method=${method}&path=${encodeURIComponent(path)}`;
  const ctxRes = await fetch(contextUrl);
  if (!ctxRes.ok) {
    throw new Error(`Failed to get ASH context: ${ctxRes.status}`);
  }
  const { nonce, contextId } = await ctxRes.json();

  // 2. Prepare body
  const bodyStr = body ? JSON.stringify(body) : '';
  let canonicalBody = bodyStr;
  if (bodyStr) {
    try {
      canonicalBody = ashCanonicalizeJson(bodyStr);
    } catch {
      canonicalBody = bodyStr;
    }
  }

  // 3. Build proof in browser
  const ashResult = await ashBrowserBuildRequest({
    nonce,
    contextId,
    method,
    path,
    body: bodyStr,
    scope,
    previousProof,
  });

  // 4. Send request with ASH headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-ash-ts': ashResult.timestamp,
    'x-ash-nonce': ashResult.nonce,
    'x-ash-body-hash': ashResult.bodyHash,
    'x-ash-proof': ashResult.proof,
    'x-ash-context-id': ashResult.contextId,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: method !== 'GET' ? canonicalBody : undefined,
  });

  const data = await response.json();

  return { response, data, proof: ashResult.proof, ashResult };
}

// Convenience: plain fetch without ASH (for public endpoints)
export async function apiFetch(path: string, options?: RequestInit & { token?: string }) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });
  return res.json();
}
