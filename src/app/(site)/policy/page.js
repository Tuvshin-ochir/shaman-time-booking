import * as settings from '@/lib/settings.js';
import * as policyStore from '@/lib/policy.js';
import { siteTranslator } from '@/i18n/index.js';
import { telHref, pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import { PolicyIntro, PolicyDetails } from '@/components/site/Policy.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('policy.title'), path: '/policy' });
}

export default function PolicyPage() {
  const t = siteTranslator();
  const business = settings.get('business');
  const policy = policyStore.get();
  return (
    <SitePage page="policy" path="/policy">
      <section className="policy-hero">
        <div className="container narrow">
          <h1>{t('policy.title')}</h1>
          <PolicyIntro policy={policy} t={t} />
        </div>
      </section>

      <section className="section section-tight">
        <div className="container narrow">
          <PolicyDetails policy={policy} t={t} />

          <aside className="policy-contact">
            <div>
              <h2>{t('policy.contact_title')}</h2>
              <p>{t('policy.contact_text')}</p>
            </div>
            <a className="btn btn-white btn-lg" href={telHref(business.phone)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />
              </svg>{' '}
              {business.phone}
            </a>
          </aside>
        </div>
      </section>
    </SitePage>
  );
}
