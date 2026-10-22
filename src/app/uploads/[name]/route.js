import fs from 'node:fs';
import path from 'node:path';
import config from '@/config.js';

// Images uploaded from the admin home page editor (DATA_DIR/uploads). Names
// contain a content hash, so they can be cached for good.
export async function GET(request, { params }) {
  const { name } = await params;
  if (!/^[\w-]+\.jpg$/.test(name)) return new Response('Not found', { status: 404 });
  let data;
  try {
    data = await fs.promises.readFile(path.join(config.dataDir, 'uploads', name));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  return new Response(data, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
