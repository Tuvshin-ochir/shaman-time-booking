const express = require('express');
const config = require('../config');
const settings = require('../lib/settings');
const slots = require('../lib/slots');
const landing = require('../lib/landing');
const policy = require('../lib/policy');
const { db } = require('../db');
const i18n = require('../i18n');
const { nowLocal, addDays, fromMin } = require('../lib/time');

const router = express.Router();

function activeServices() {
  return db().prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id').all();
}

// Earliest free start times of the shortest service, for the home page card.
function nextFreeSlot() {
  const service = db()
    .prepare('SELECT * FROM services WHERE active = 1 ORDER BY duration_min, sort, id LIMIT 1')
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

function page(view, titleKey, extra = () => ({})) {
  return (req, res) => {
    res.render(view, {
      page: view,
      title: titleKey ? res.locals.t(titleKey) : null,
      ...extra(req, res),
    });
  };
}

router.get(
  '/',
  page('home', null, () => {
    const content = settings.get('content');
    return {
      services: activeServices(),
      hours: openingHours(),
      content,
      highlights: lines(content.highlights_mn),
      prepare: lines(content.prepare_mn),
      faq: faqItems(content.faq_mn),
      gallery: landing.gallery(),
      nextSlot: nextFreeSlot(),
      preloadHero: true,
    };
  })
);
router.get('/services', page('services', 'services.title', () => ({ services: activeServices() })));
router.get('/about', page('about', 'about.title', () => ({ content: settings.get('content') })));
router.get('/contact', page('contact', 'contact.title', () => ({ hours: openingHours() })));
router.get('/policy', page('policy', 'policy.title', () => ({ policy: policy.get() })));

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    ['User-agent: *', 'Disallow: /admin', 'Disallow: /pay/', 'Disallow: /booking/', 'Disallow: /api/', '', `Sitemap: ${config.baseUrl}/sitemap.xml`, ''].join('\n')
  );
});

router.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/services', '/book', '/about', '/contact', '/policy']
    .map((p) => `  <url><loc>${config.baseUrl}${p}</loc></url>`)
    .join('\n');
  res
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

router.get('/healthz', (req, res) => {
  db().prepare('SELECT 1').get();
  res.type('text/plain').send('ok');
});

module.exports = router;
