import config from '@/config.js';
import * as news from '@/lib/news.js';

export const dynamic = 'force-dynamic';

export function GET() {
  const urls = ['/', '/services', '/book', '/about', '/contact', '/policy', '/news', ...news.list().map((n) => `/news/${n.id}`)]
    .map((p) => `  <url><loc>${config.baseUrl}${p}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
