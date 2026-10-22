// Data and metadata helpers shared by the public site pages (src/app/(site)).
import config from '../config.js';
import { db } from '../db.js';
import * as settings from './settings.js';
import * as slots from './slots.js';
import * as landing from './landing.js';
import * as i18n from '../i18n/index.js';
import { nowLocal, addDays, fromMin } from './time.js';

function activeServices() {
  return db().prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id').all();
}

// Earliest free start times of the shortest service, for the home page card.
// Special services are booked by day, without times, so they are left out.
function nextFreeSlot() {
  const service = db()
    .prepare(`SELECT * FROM services WHERE active = 1 AND kind != 'special' ORDER BY duration_min, sort, id LIMIT 1`)
    .get();
  if (!service) return null;
  const day = slots.availableDays(service).find((d) => d.free > 0);
  if (!day) return null;
  const today = nowLocal().date;
  const times = slots.availableTimes(service, day.date).map(fromMin);
  return {
    service,
    date: day.date,
    time: times[0],
    more: times.slice(1, 5),
    parts: i18n.dateParts(day.date),
    when: day.date === today ? 'today' : day.date === addDays(today, 1) ? 'tomorrow' : null,
  };
}

// Monday-first opening hours for display.
function openingHours() {
  const t = i18n.translator();
  const weekly = settings.get('schedule').weekly;
  return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const day = weekly[wd];
    const hasBreak = day.open && day.break_start && day.break_end;
    return {
      name: i18n.DAY_NAMES[wd],
      open: day.open,
      hours: day.open ? `${day.start}–${day.end}` : t('hours.closed'),
      note: hasBreak ? t('hours.break', { from: day.break_start, to: day.break_end }) : null,
    };
  });
}

const lines = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

// "Question\nAnswer..." blocks separated by blank lines.
function faqItems(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((block) => {
      const [question, ...answer] = block.trim().split('\n');
      return { q: (question || '').trim(), a: answer.join('\n').trim() };
    })
    .filter((item) => item.q && item.a);
}

const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

// <head> tags of every public page: title, description, canonical URL and the
// Open Graph tags Facebook reads when a link is shared.
// `description` and `image` ({ src, width, height }) default to the tagline and the share picture.
function pageMetadata({ title = null, path, description = null, image = null }) {
  const business = settings.get('business');
  const t = i18n.siteTranslator();
  const pageTitle = title ? `${title} | ${business.name}` : `${business.name} — ${t('cta.book')}`;
  description = description || business.tagline;
  const canonical = config.baseUrl + path;
  const og = image || landing.image('og');
  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: business.name,
      title: pageTitle,
      description,
      url: canonical,
      images: [{ url: config.baseUrl + og.src, type: 'image/jpeg', width: og.width, height: og.height, alt: business.name }],
      locale: 'mn_MN',
    },
    twitter: { card: 'summary_large_image' },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/img/favicon-32.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: '/img/apple-touch-icon.png',
    },
  };
}

export { activeServices, nextFreeSlot, openingHours, lines, faqItems, telHref, pageMetadata };
