import * as news from '@/lib/news.js';
import { formatDate } from '@/i18n/index.js';
import { nowLocal } from '@/lib/time.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import ActionForm from '@/components/admin/ActionForm.js';
import ModalLink from '@/components/admin/ModalLink.js';
import ScrollArea from '@/components/ScrollArea.js';
import NewsForm from './NewsForm.js';
import NewsView from './NewsView.js';
import { createNews, updateNews, deleteNews } from './actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Мэдээ');
}

export default async function NewsPage() {
  await requireAdmin();
  const items = news.list({ all: true });
  const today = nowLocal().date;
  // Keys that change on every render: after a save the dialogs start closed and fresh (ModalLink.js).
  const stamp = Date.now();
  return (
    <>
      <div className="a-head">
        <h1>
          Мэдээ мэдээлэл <small className="a-count">{items.length}</small>
        </h1>
        <div className="a-head-actions">
          <ModalLink
            key={stamp}
            className="a-btn a-btn-primary"
            href="/admin/news/new"
            title="Мэдээ нэмэх"
            wide
            content={<NewsForm action={createNews} today={today} sizes={news.IMAGE_SIZES} />}
          >
            + Мэдээ нэмэх
          </ModalLink>
        </div>
      </div>
      <p className="muted small">Нийтэлсэн мэдээ нүүр хуудасны «Мэдээ мэдээлэл» хэсэгт (шинэ нь эхэндээ) болон /news хуудсанд харагдана.</p>

      {items.length ? (
        <ScrollArea className="a-table-wrap">
          <table className="a-table news-table">
            <thead>
              <tr>
                <th>Огноо</th>
                <th>Гарчиг</th>
                <th>Төлөв</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} className={n.published ? '' : 'is-muted'}>
                  <td className="nowrap">{formatDate(n.date)}</td>
                  <td>
                    <strong>{n.title}</strong>
                    <br />
                    <small>{news.excerpt(n, 90)}</small>
                  </td>
                  <td>
                    <span className={`badge ${n.published ? 'badge-confirmed' : 'badge-muted'}`}>{n.published ? 'Нийтэлсэн' : 'Ноорог'}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <ModalLink
                        key={`view-${stamp}`}
                        className="a-btn a-btn-sm"
                        href={n.published ? `/news/${n.id}` : `/admin/news/${n.id}`}
                        title={n.title}
                        wide
                        content={<NewsView item={n} />}
                      >
                        Харах
                      </ModalLink>
                      <ModalLink
                        key={`edit-${stamp}`}
                        className="a-btn a-btn-sm"
                        href={`/admin/news/${n.id}`}
                        title="Мэдээ засах"
                        wide
                        content={<NewsForm action={updateNews.bind(null, n.id)} item={n} today={today} sizes={news.IMAGE_SIZES} />}
                      >
                        Засах
                      </ModalLink>
                      <ActionForm
                        action={deleteNews.bind(null, n.id)}
                        className="inline-form"
                        confirm={`«${n.title}» мэдээг устгах уу?`}
                        confirmLabel="Устгах"
                        confirmDanger
                      >
                        <button className="a-btn a-btn-sm a-btn-danger-ghost" type="submit">
                          Устгах
                        </button>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <p className="a-empty">Одоогоор мэдээ алга. «+ Мэдээ нэмэх» товчоор эхний мэдээгээ нэмнэ үү.</p>
      )}
    </>
  );
}
