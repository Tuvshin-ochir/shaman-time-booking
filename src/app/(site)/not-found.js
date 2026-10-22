import * as settings from '@/lib/settings.js';
import { siteTranslator } from '@/i18n/index.js';
import SitePage from '@/components/site/SitePage.js';

export function generateMetadata() {
  return { title: `${siteTranslator()('err.404_title')} | ${settings.get('business').name}` };
}

export default function NotFound() {
  const t = siteTranslator();
  return (
    <SitePage path="">
      <section className="section">
        <div className="container narrow result-card">
          <h1>{t('err.404_title')}</h1>
          <p className="muted">{t('err.404_text')}</p>
          <p>
            <a className="btn btn-primary" href="/">
              {t('booking.home')}
            </a>
          </p>
        </div>
      </section>
    </SitePage>
  );
}
