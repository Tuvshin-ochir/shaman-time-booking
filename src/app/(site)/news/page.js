import * as news from '@/lib/news.js';
import { siteTranslator } from '@/i18n/index.js';
import { pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import NewsCard from '@/components/site/NewsCard.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('news.title'), path: '/news' });
}

export default function NewsListPage() {
  const t = siteTranslator();
  const items = news.list();
  return (
    <SitePage page="news" path="/news">
      <section className="section page-head">
        <div className="container">
          <h1>{t('news.title')}</h1>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          {items.length ? (
            <div className="news-grid">
              {items.map((item) => (
                <NewsCard key={item.id} item={item} t={t} />
              ))}
            </div>
          ) : (
            <p className="muted">{t('news.empty')}</p>
          )}
        </div>
      </section>
    </SitePage>
  );
}
