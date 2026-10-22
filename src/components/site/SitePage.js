import * as settings from '@/lib/settings.js';
import { siteTranslator } from '@/i18n/index.js';
import Header from './Header.js';
import Footer from './Footer.js';

// Header, main and footer around a public page. `page` names the page for CSS
// (.page-home, .page-book, ...); `sticky` adds the bottom "Цаг захиалах" bar on phones.
export default function SitePage({ page = 'default', path, sticky = true, children }) {
  const t = siteTranslator();
  const business = settings.get('business');
  return (
    <div className={`page-${page}${sticky ? ' has-sticky' : ''}`}>
      <a className="skip-link" href="#main">
        Агуулга руу шилжих
      </a>
      <Header path={path} t={t} business={business} />
      <main id="main">{children}</main>
      <Footer t={t} business={business} />
      {sticky && (
        <div className="sticky-cta">
          <a className="btn btn-primary btn-block btn-lg" href="/book">
            {t('cta.book')}
          </a>
        </div>
      )}
    </div>
  );
}
