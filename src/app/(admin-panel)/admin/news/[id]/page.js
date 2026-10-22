import { notFound } from 'next/navigation';
import * as news from '@/lib/news.js';
import { nowLocal } from '@/lib/time.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ActionForm from '@/components/admin/ActionForm.js';
import NewsForm from '../NewsForm.js';
import { updateNews, deleteNews } from '../actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Мэдээ засах');
}

export default async function EditNewsPage({ params }) {
  await requireAdmin();
  const item = news.get((await params).id, { all: true });
  if (!item) notFound();
  return (
    <>
      <p>
        <a href="/admin/news">← Мэдээ</a>
      </p>
      <div className="a-head">
        <h1>Мэдээ засах</h1>
        {item.published ? (
          <div className="a-head-actions">
            <a className="a-btn" href={`/news/${item.id}`} target="_blank" rel="noopener">
              Сайтаас харах ↗
            </a>
          </div>
        ) : null}
      </div>
      <NewsForm action={updateNews.bind(null, item.id)} item={item} today={nowLocal().date} sizes={news.IMAGE_SIZES} />
      <ActionForm action={deleteNews.bind(null, item.id)} confirm={`«${item.title}» мэдээг устгах уу?`} confirmLabel="Устгах" confirmDanger>
        <button className="a-btn a-btn-danger-ghost" type="submit">
          Мэдээг устгах
        </button>
      </ActionForm>
    </>
  );
}
