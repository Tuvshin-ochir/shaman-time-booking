import * as settings from '@/lib/settings.js';
import * as policyStore from '@/lib/policy.js';
import { siteTranslator } from '@/i18n/index.js';
import Header from './Header.js';
import Footer from './Footer.js';
import PolicyDialog from './PolicyDialog.js';
import { PolicyIntro, PolicyDetails } from './Policy.js';

// Header, main and footer around a public page. `page` names the page for CSS
// (.page-home, .page-book, ...); `sticky` adds the bottom "Цаг захиалах" bar on phones.
// Links to the cancellation policy open it in a dialog (not on /policy itself).
export default function SitePage({ page = 'default', path, sticky = true, children }) {
  const t = siteTranslator();
  const business = settings.get('business');
  const policy = page === 'policy' ? null : policyStore.get();
  return (
    <div className={`page-${page}${sticky ? ' has-sticky' : ''}`}>
      <a className="skip-link" href="#main">
        Агуулга руу шилжих
      </a>
      <Header path={path} t={t} business={business} />
      <main id="main">{children}</main>
      <Footer t={t} business={business} />
      {policy && (
        <PolicyDialog
          title={t('policy.title')}
          labels={{ close: t('policy.close'), agree: t('policy.agree'), scrollHint: t('policy.scroll_hint'), readDone: t('policy.read_done') }}
        >
          <PolicyIntro policy={policy} t={t} />
          <PolicyDetails policy={policy} t={t} />
        </PolicyDialog>
      )}
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
