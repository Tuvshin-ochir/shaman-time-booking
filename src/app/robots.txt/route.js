import config from '@/config.js';

export const dynamic = 'force-dynamic';

export function GET() {
  const body = ['User-agent: *', 'Disallow: /admin', 'Disallow: /pay/', 'Disallow: /booking/', 'Disallow: /api/', '', `Sitemap: ${config.baseUrl}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
