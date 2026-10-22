import { NextResponse } from 'next/server';

const isDev = process.env.NODE_ENV === 'development';

// QPay returns bank logos as remote https images and the QR as a data: URI;
// the admin image editor previews picked files through blob: URLs. Next.js
// adds the nonce to its own scripts.
function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    // Development injects styles inline for hot reloading.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// Pages with personal data or admin tools stay out of search engines and caches.
const PRIVATE = /^\/(admin|pay|booking)(\/|$)/;

export function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce);
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', csp);
  // Lets server components know the full URL (e.g. for the login "next" link).
  requestHeaders.set('x-url', pathname + search);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  if (PRIVATE.test(pathname)) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|img/|uploads/|favicon).*)'],
};
