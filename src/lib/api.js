// Helpers for the JSON route handlers.
import { headers } from 'next/headers';
import { limiter, clientIp } from './http.js';

const perMinute = limiter('api', { windowMs: 60 * 1000, max: 120 });

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Returns a 429 response when the caller is over the limit, otherwise null.
async function apiLimit() {
  const { ok, retryAfter } = perMinute(clientIp(await headers()));
  return ok ? null : new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

export { json, apiLimit };
