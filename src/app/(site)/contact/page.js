import * as settings from '@/lib/settings.js';
import { siteTranslator } from '@/i18n/index.js';
import { openingHours, telHref, pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import Hours from '@/components/site/Hours.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('contact.title'), path: '/contact' });
}

export default function ContactPage() {
  const t = siteTranslator();
  const business = settings.get('business');
  const tel = telHref(business.phone);
  return (
    <SitePage page="contact" path="/contact">
      <section className="section page-head">
        <div className="container">
          <h1>{t('contact.title')}</h1>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container two-col">
          <div className="contact-list">
            <div className="contact-item">
              <p className="contact-label">{t('contact.phone')}</p>
              <p>
                <a className="phone-link" href={tel}>
                  {business.phone}
                </a>
              </p>
              <a className="btn btn-primary btn-sm" href={tel}>
                {t('contact.call')}
              </a>
            </div>
            <div className="contact-item">
              <p className="contact-label">{t('contact.address')}</p>
              <p>{business.address}</p>
              {business.map_url && (
                <a className="btn btn-ghost btn-sm" href={business.map_url} target="_blank" rel="noopener">
                  {t('contact.map')}
                </a>
              )}
            </div>
            {business.email && (
              <div className="contact-item">
                <p className="contact-label">{t('contact.email')}</p>
                <p>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </p>
              </div>
            )}
            {business.facebook_url && (
              <div className="contact-item">
                <p className="contact-label">Facebook</p>
                <p>
                  <a href={business.facebook_url} target="_blank" rel="noopener">
                    {t('contact.facebook')}
                  </a>
                </p>
              </div>
            )}
          </div>
          <div className="info-card">
            <h2 className="h3">{t('home.hours_title')}</h2>
            <Hours hours={openingHours()} />
          </div>
        </div>
      </section>
    </SitePage>
  );
}
