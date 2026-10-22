import { formatDate } from '@/i18n/index.js';

// A post as it reads on the site (the "Харах" dialog of the news list).
export default function NewsView({ item }) {
  const img = item.image;
  return (
    <article className="news-view">
      <p className="news-view-meta">
        <time dateTime={item.date}>{formatDate(item.date)}</time>{' '}
        <span className={`badge ${item.published ? 'badge-confirmed' : 'badge-muted'}`}>{item.published ? 'Нийтэлсэн' : 'Ноорог'}</span>
      </p>
      {img && <img className="news-view-img" src={img.src} width={img.width} height={img.height} alt="" loading="lazy" />}
      {/* Cleaned to a few formatting tags when saved (src/lib/rich-text.js). */}
      <div className="news-preview" dangerouslySetInnerHTML={{ __html: item.body }} />
      {item.published ? (
        <p className="news-view-foot">
          <a className="a-btn a-btn-sm" href={`/news/${item.id}`} target="_blank" rel="noopener">
            Сайтаас нээх ↗
          </a>
        </p>
      ) : (
        <p className="news-view-foot muted small">Ноорог тул сайтад харагдахгүй. Засах цонхноос «Сайтад нийтлэх»-ийг чагтална.</p>
      )}
    </article>
  );
}
