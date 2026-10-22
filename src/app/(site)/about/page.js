import * as settings from '@/lib/settings.js';
import * as landing from '@/lib/landing.js';
import { siteTranslator } from '@/i18n/index.js';
import { pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import Paragraphs from '@/components/Paragraphs.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('about.title'), path: '/about' });
}

export default function AboutPage() {
  const t = siteTranslator();
  const content = settings.get('content');
  const aboutImg = landing.image('about');
  const srcSet = landing.srcset(aboutImg);
  return (
    <SitePage page="about" path="/about">
      <section className="section page-head">
        <div className="container narrow">
          <h1>{t('about.title')}</h1>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container narrow prose">
          <figure className="about-media">
            <img
              src={aboutImg.small || aboutImg.src}
              {...(srcSet ? { srcSet, sizes: '(min-width: 700px) 640px, 100vw' } : {})}
              width={aboutImg.width}
              height={aboutImg.height}
              alt=""
            />
          </figure>
          <Paragraphs text={content.about_mn} />
          <p>
            <a className="btn btn-primary" href="/book">
              {t('cta.book')}
            </a>
          </p>
        </div>
      </section>
    </SitePage>
  );
}
