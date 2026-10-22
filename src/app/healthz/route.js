import { db } from '@/db.js';

export const dynamic = 'force-dynamic';

export function GET() {
  db().prepare('SELECT 1').get();
  return new Response('ok', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
