import * as news from '@/lib/news.js';
import { nowLocal } from '@/lib/time.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import NewsForm from '../NewsForm.js';
import { createNews } from '../actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Мэдээ нэмэх');
}

export default async function NewNewsPage() {
  await requireAdmin();
  return (
    <>
      <p>
        <a href="/admin/news">← Мэдээ</a>
      </p>
      <h1>Мэдээ нэмэх</h1>
      <NewsForm action={createNews} today={nowLocal().date} sizes={news.IMAGE_SIZES} />
    </>
  );
}
