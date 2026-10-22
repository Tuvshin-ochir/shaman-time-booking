import * as settings from '@/lib/settings.js';
import * as policyStore from '@/lib/policy.js';
import { siteTranslator } from '@/i18n/index.js';
import { telHref, pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import Paragraphs from '@/components/Paragraphs.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('policy.title'), path: '/policy' });
}

const ICONS = {
  good: <path d="M6 12.5l4 4 8-9" />,
  warn: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </>
  ),
  bad: <path d="M7 7l10 10M17 7L7 17" />,
};

export default function PolicyPage() {
  const t = siteTranslator();
  const business = settings.get('business');
  const policy = policyStore.get();
  return (
    <SitePage page="policy" path="/policy">
      <section className="policy-hero">
        <div className="container narrow">
          <h1>{t('policy.title')}</h1>
          {policy.intro_mn && (
            <div className="lead">
              <Paragraphs text={policy.intro_mn} />
            </div>
          )}
          {policy.updated_at && (
            <p className="policy-meta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>{' '}
              {t('policy.updated')}: {policy.updated_at.replace(/-/g, '.')}
            </p>
          )}
        </div>
      </section>

      <section className="section section-tight">
        <div className="container narrow">
          {policy.highlights.length > 0 && (
            <>
              <h2 className="policy-label">{t('policy.in_short')}</h2>
              <div className="policy-cards">
                {policy.highlights.map((h, i) => (
                  <div key={i} className={`policy-card tone-${h.tone}`}>
                    <span className="policy-card-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {ICONS[h.tone] || ICONS.good}
                      </svg>
                    </span>
                    <div>
                      <h3>{h.title_mn}</h3>
                      {h.text_mn && <p>{h.text_mn}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {policy.sections.length > 0 && (
            <>
              <h2 className="policy-label">{t('policy.details')}</h2>
              <div className="policy-sections">
                {policy.sections.map((s, i) => (
                  <section key={i} className="policy-section">
                    <h3>
                      <span className="policy-num">{i + 1}</span>
                      {s.title_mn}
                    </h3>
                    <div className="prose">
                      <Paragraphs text={s.body_mn} />
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

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
