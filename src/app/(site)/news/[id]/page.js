import { notFound } from 'next/navigation';
import * as news from '@/lib/news.js';
import { siteTranslator, formatDate } from '@/i18n/index.js';
import { pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const item = news.get((await params).id);
  if (!item) return {};
  return pageMetadata({ title: item.title, path: `/news/${item.id}`, description: news.excerpt(item, 200), image: item.image });
}

export default async function NewsArticlePage({ params }) {
  const item = news.get((await params).id);
  if (!item) notFound();
  const t = siteTranslator();
  const img = item.image;
  return (
    <SitePage page="news" path="/news">
      <article className="section news-article">
        <div className="container narrow">
          <p className="news-back">
            <a href="/news">← {t('news.back')}</a>
          </p>
          <time className="news-date" dateTime={item.date}>
            {formatDate(item.date)}
          </time>
          <h1>{item.title}</h1>
          {img && (
            <figure className="news-cover">
              <img
                src={img.src}
                {...(img.small ? { srcSet: `${img.small} ${img.smallWidth}w, ${img.src} ${img.width}w`, sizes: '(min-width: 720px) 640px, 100vw' } : {})}
                width={img.width}
                height={img.height}
                alt=""
              />
            </figure>
          )}
          {/* Cleaned to a few formatting tags when saved (src/lib/rich-text.js). */}
          <div className="news-content" dangerouslySetInnerHTML={{ __html: item.body }} />
        </div>
      </article>
    </SitePage>
  );
}
