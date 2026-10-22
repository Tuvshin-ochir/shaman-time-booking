import { siteTranslator } from '@/i18n/index.js';
import { activeServices, pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import ServiceCard from '@/components/site/ServiceCard.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('services.title'), path: '/services' });
}

export default function ServicesPage() {
  const t = siteTranslator();
  const services = activeServices();
  return (
    <SitePage page="services" path="/services">
      <section className="section page-head">
        <div className="container">
          <h1>{t('services.title')}</h1>
          <p className="lead">{t('services.intro')}</p>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          {services.length ? (
            <div className="cards">
              {services.map((s) => (
                <ServiceCard key={s.id} s={s} t={t} />
              ))}
            </div>
          ) : (
            <p className="muted">{t('services.empty')}</p>
          )}
          <p className="muted small">
            <a href="/policy">{t('nav.policy')}</a>
          </p>
        </div>
      </section>
    </SitePage>
  );
}
