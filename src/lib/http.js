import { shared } from './shared.js';

// Small fixed-window in-memory limiter; enough for a single-process app.
// limiter(name, { windowMs, max })(key) -> { ok, retryAfter }
function limiter(name, { windowMs, max }) {
  const hits = shared(`rateLimit:${name}`, () => new Map());
  return (key) => {
    const now = Date.now();
    if (hits.size > 10000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    return { ok: entry.count <= max, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  };
}

// Client address behind nginx on the same host: nginx appends the real address
// to X-Forwarded-For, so the last entry is the one we can trust.
function clientIp(headers) {
  const forwarded = String(headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return forwarded.at(-1) || headers.get('x-real-ip') || '127.0.0.1';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { limiter, clientIp, escapeHtml };
