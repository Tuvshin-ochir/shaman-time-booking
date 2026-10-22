import { revalidatePath } from 'next/cache';
import * as auth from '@/lib/auth.js';
import * as landing from '@/lib/landing.js';
import { currentAdmin, sessionCookie } from '@/lib/admin.js';

const MAX_BYTES = 8 * 1024 * 1024;

// Image upload from the home page editor. The browser already resized and
// re-encoded the image (LandingEditor.js), so this only accepts modest JPEGs.
export async function POST(request) {
  if (!(await currentAdmin())) return new Response('Нэвтрэх шаардлагатай.', { status: 401 });
  const sent = request.headers.get('x-csrf-token') || '';
  if (!auth.safeEqual(sent, auth.csrfToken(await sessionCookie()))) {
    return new Response('Хамгаалалтын токен буруу байна. Хуудсаа дахин ачаалаад оролдоно уу.', { status: 403 });
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) {
    return Response.json({ error: 'Зураг хэт том байна (4 MB-аас бага).' }, { status: 413 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Зургийн өгөгдөл буруу.' }, { status: 400 });
  }
  try {
    if (body.slot === 'gallery') landing.setGalleryImage(body.index, body);
    else landing.setImage(body.slot, body);
  } catch (err) {
    if (!(err instanceof landing.LandingError)) throw err;
    return Response.json({ error: err.message }, { status: 400 });
  }
  revalidatePath('/', 'layout');
  return Response.json({ ok: true });
}
