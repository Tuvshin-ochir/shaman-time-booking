import { preload } from 'react-dom';
import * as settings from '@/lib/settings.js';
import * as landing from '@/lib/landing.js';
import * as news from '@/lib/news.js';
import { siteTranslator, formatPrice } from '@/i18n/index.js';
import { nowLocal, toMin, localToEpoch } from '@/lib/time.js';
import { nextFreeSlot, openingHours, lines, faqItems, telHref, pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import Hours from '@/components/site/Hours.js';
import HeroSky from '@/components/site/HeroSky.js';
import NewsCard from '@/components/site/NewsCard.js';
import ScrollArea from '@/components/ScrollArea.js';
import Paragraphs from '@/components/Paragraphs.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ path: '/' });
}

// Responsive <img> attributes for an image from src/lib/landing.js.
function imgProps(img, sizes) {
  const srcSet = landing.srcset(img);
  return { src: img.small || img.src, ...(srcSet ? { srcSet, sizes } : {}), width: img.width, height: img.height };
}

// `/?sky=21:30` previews the hero sky at that time of today.
function skyPreview(value) {
  const minutes = toMin(value);
  return Number.isNaN(minutes) ? null : localToEpoch(nowLocal().date, minutes);
}

export default async function HomePage({ searchParams }) {
  const preview = skyPreview((await searchParams).sky);
  const t = siteTranslator();
  const business = settings.get('business');
  const content = settings.get('content');
  const hours = openingHours();
  const highlights = lines(content.highlights_mn);
  const prepare = lines(content.prepare_mn);
  const faq = faqItems(content.faq_mn);
  const gallery = landing.gallery();
  const newsItems = news.list({ limit: 12 });
  const nextSlot = nextFreeSlot();

  const heroImg = landing.image('hero');
  const introImg = landing.image('intro');
  const prepareImg = landing.image('prepare');
  const ctaImg = landing.image('cta');
  const heroSrcSet = landing.srcset(heroImg);
  preload(heroImg.small || heroImg.src, {
    as: 'image',
    fetchPriority: 'high',
    ...(heroSrcSet ? { imageSrcSet: heroSrcSet, imageSizes: '100vw' } : {}),
  });
  const bookHref = (time) => `/book?service=${nextSlot.service.id}&date=${nextSlot.date}&time=${time}`;

  return (
    <SitePage page="home" path="/">
      <section className="hero hero-photo">
        <img className="hero-img" {...imgProps(heroImg, '100vw')} alt="" fetchPriority="high" />
        <HeroSky at={preview ?? Date.now()} preview={preview !== null} />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{t('home.eyebrow')}</p>
            <h1>{business.name}</h1>
            <p className="lead">{business.tagline}</p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="/book">
                {t('home.hero_btn_primary')}
              </a>
              <a className="btn btn-light btn-lg" href="/services">
                {t('home.hero_btn_secondary')}
              </a>
            </div>
            <ul className="trust">
              <li>{t('home.trust_online')}</li>
              <li>{t('home.trust_qpay')}</li>
              <li>{t('home.trust_sms')}</li>
            </ul>
          </div>

          <aside className="slot-card" aria-label={t('home.next_free')}>
            <p className="slot-card-head">
              <span className="live-dot" aria-hidden="true"></span>
              {t('home.next_free')}
            </p>
            {nextSlot ? (
              <>
                <div className="slot-card-main">
                  <div className="slot-date" aria-hidden="true">
                    <span className="slot-date-month">{nextSlot.parts.month}</span>
                    <span className="slot-date-day">{nextSlot.parts.day}</span>
                    <span className="slot-date-wd">{nextSlot.parts.weekdayShort}</span>
                  </div>
                  <div className="slot-time">
                    <span className="slot-when">{nextSlot.when ? t(`home.${nextSlot.when}`) : nextSlot.parts.weekday}</span>
                    <strong>{nextSlot.time}</strong>
                    <span className="slot-service">
                      {nextSlot.service.name} · {t('services.duration', { n: nextSlot.service.duration_min })}
                    </span>
                  </div>
                </div>
                {nextSlot.more.length > 0 && (
                  <div className="slot-more">
                    <p className="slot-more-label">{t('home.next_more')}</p>
                    <div className="slot-chips">
                      {nextSlot.more.map((time) => (
                        <a key={time} className="slot-chip" href={bookHref(time)}>
                          {time}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <a className="btn btn-primary btn-block btn-lg slot-cta" href={bookHref(nextSlot.time)}>
                  {t('home.next_take')}{' '}
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <p className="slot-foot">
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 10V8a6 6 0 1112 0v2m-13 0h14v11H5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>{' '}
                  {formatPrice(nextSlot.service.price)} · {t('home.trust_qpay')}
                </p>
              </>
            ) : (
              <>
                <p className="slot-empty">{t('home.next_none')}</p>
                <a className="btn btn-primary btn-block btn-lg" href="/book">
                  {t('home.hero_btn_primary')}
                </a>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="container intro">
          <figure className="intro-media">
            <img {...imgProps(introImg, '(min-width: 900px) 440px, 100vw')} loading="lazy" decoding="async" alt="" />
          </figure>
          <div className="intro-copy">
            <p className="eyebrow eyebrow-soft">{t('home.intro_eyebrow')}</p>
            <h2>{content.home_title_mn}</h2>
            <div className="prose">
              <Paragraphs text={content.home_intro_mn} />
            </div>
            {highlights.length > 0 && (
              <ul className="highlights">
                {highlights.map((h, i) => (
                  <li key={i}>
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="11" fill="currentColor" opacity=".12" />
                      <path d="M7 12.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <a href="/about">{t('home.intro_link')} →</a>
          </div>
        </div>
      </section>

      {prepare.length > 0 && (
        <section className="section section-soft">
          <div className="container split">
            <div>
              <h2>{t('home.prepare_title')}</h2>
              <p className="section-sub">{t('home.prepare_sub')}</p>
              <ol className="checklist">
                {prepare.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
            <figure className="split-media">
              <img {...imgProps(prepareImg, '(min-width: 720px) 50vw, 100vw')} loading="lazy" decoding="async" alt="" />
            </figure>
          </div>
        </section>
      )}

      {newsItems.length > 0 && (
        <section className="section section-news">
          <div className="container">
            <div className="section-head">
              <h2>{t('home.news_title')}</h2>
              <a href="/news">{t('home.news_all')} →</a>
            </div>
            <ScrollArea className="news-strip" role="list" aria-label={t('home.news_title')}>
              {newsItems.map((item) => (
                <div key={item.id} className="news-strip-item" role="listitem">
                  <NewsCard item={item} t={t} />
                </div>
              ))}
            </ScrollArea>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="section">
          <div className="container">
            <h2>{t('home.gallery_title')}</h2>
            <div className="gallery">
              {gallery.map((g, i) => (
                <figure key={i}>
                  <img
                    {...imgProps(g, i === 0 ? '(min-width: 720px) 50vw, 100vw' : '(min-width: 720px) 25vw, 50vw')}
                    loading="lazy"
                    decoding="async"
                    alt={g.caption_mn || ''}
                  />
                  {g.caption_mn && <figcaption>{g.caption_mn}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section className="section section-soft">
          <div className="container">
            <h2>{t('home.faq_title')}</h2>
            <div className="faq">
              {faq.map((item, i) => (
                <details key={i} open={i === 0}>
                  <summary>{item.q}</summary>
                  <Paragraphs text={item.a} />
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container two-col">
          <div>
            <h2>{t('home.contact_title')}</h2>
            <div className="contact-list">
              <div className="contact-item">
                <p className="contact-label">{t('contact.address')}</p>
                <p>{business.address}</p>
                {business.map_url && (
                  <a className="btn btn-ghost btn-sm" href={business.map_url} target="_blank" rel="noopener">
                    {t('contact.map')}
                  </a>
                )}
              </div>
              <div className="contact-item">
                <p className="contact-label">{t('contact.phone')}</p>
                <p>
                  <a className="phone-link" href={telHref(business.phone)}>
                    {business.phone}
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="info-card">
            <h2 className="h3">{t('home.hours_title')}</h2>
            <Hours hours={hours} />
          </div>
        </div>
      </section>

      <section className="cta-band">
        <img className="cta-img" {...imgProps(ctaImg, '100vw')} loading="lazy" decoding="async" alt="" />
        <div className="container">
          <h2>{t('home.cta_title')}</h2>
          <p>{t('home.cta_text')}</p>
          <a className="btn btn-primary btn-lg" href="/book">
            {t('home.cta_btn')}
          </a>
        </div>
      </section>
    </SitePage>
  );
}
