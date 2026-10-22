import { formatDate } from '@/i18n/index.js';
import * as news from '@/lib/news.js';
import Logo from '../Logo.js';

// One news post as a card (home page strip and /news).
export default function NewsCard({ item, t }) {
  const img = item.image;
  return (
    <a className="news-card" href={`/news/${item.id}`}>
      <span className="news-card-media">
        {img ? (
          <img
            src={img.small || img.src}
            {...(img.small ? { srcSet: `${img.small} ${img.smallWidth}w, ${img.src} ${img.width}w`, sizes: '(min-width: 720px) 340px, 85vw' } : {})}
            width={img.width}
            height={img.height}
            loading="lazy"
            decoding="async"
            alt=""
          />
        ) : (
          <span className="news-card-blank" aria-hidden="true">
            <Logo />
          </span>
        )}
      </span>
      <span className="news-card-body">
        <time dateTime={item.date}>{formatDate(item.date)}</time>
        <strong className="news-card-title">{item.title}</strong>
        <span className="news-card-text">{news.excerpt(item)}</span>
        <span className="news-card-more">{t('news.more')} →</span>
      </span>
    </a>
  );
}
