const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const config = require('./config');
const settings = require('./lib/settings');
const i18n = require('./i18n');
const { cookies, securityHeaders, paragraphs } = require('./lib/http');
const { fromMin } = require('./lib/time');
const { formatPhone } = require('./lib/phone');
const qpay = require('./lib/qpay');
const landing = require('./lib/landing');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// /assets/css/style.css -> /assets/css/style.css?v=<content hash>, so assets can be cached for a year.
function assetUrl() {
  const cache = new Map();
  return (file) => {
    if (config.isProd && cache.has(file)) return cache.get(file);
    let url = file;
    try {
      const hash = crypto.createHash('sha1').update(fs.readFileSync(path.join(PUBLIC_DIR, file))).digest('hex');
      url = `${file}?v=${hash.slice(0, 10)}`;
    } catch {
      // missing file: serve the plain path
    }
    cache.set(file, url);
    return url;
  };
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // behind nginx on the same host
  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  if (config.isProd) app.set('view cache', true);

  app.use(securityHeaders);
  app.use(
    '/assets',
    express.static(path.join(PUBLIC_DIR, 'assets'), {
      maxAge: config.isProd ? '365d' : 0,
      immutable: config.isProd,
      index: false,
    })
  );
  app.use(express.static(PUBLIC_DIR, { maxAge: config.isProd ? '7d' : 0, index: false }));
  // Images uploaded from the admin home page editor; names contain a content hash.
  app.use(
    '/uploads',
    express.static(path.join(config.dataDir, 'uploads'), { maxAge: '365d', immutable: true, index: false })
  );
  app.use(cookies);
  app.use(i18n.middleware);

  const asset = assetUrl();
  app.use((req, res, next) => {
    const business = settings.get('business');
    Object.assign(res.locals, {
      config,
      business,
      asset,
      path: req.path,
      canonical: config.baseUrl + req.path,
      year: new Date().getFullYear(),
      formatPrice: i18n.formatPrice,
      formatPhone,
      fromMin,
      paragraphs,
      qpayMock: qpay.isMock(),
      showStickyCta: true,
      siteImage: landing.image,
      srcset: landing.srcset,
      // Explicit light/dark choice from the theme toggle; empty = follow the system.
      theme: ['light', 'dark'].includes(req.cookies.theme) ? req.cookies.theme : '',
    });
    next();
  });
  // Image uploads (already resized in the browser) need a larger JSON limit;
  // body-parser skips the global parsers once this one has read the body.
  app.use('/admin/landing/image', express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: false, limit: '200kb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use(require('./routes/public'));
  app.use(require('./routes/booking'));
  app.use('/admin', require('./routes/admin'));

  app.use((req, res) => {
    res.status(404).render('error', {
      title: res.locals.t('err.404_title'),
      heading: res.locals.t('err.404_title'),
      message: res.locals.t('err.404_text'),
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    if (res.headersSent) return;
    const t = res.locals.t || i18n.translator();
    if (req.path.startsWith('/api/') || req.path === '/qpay/callback') {
      return res.status(500).json({ error: 'internal_error' });
    }
    res.status(err.status && err.status < 500 ? err.status : 500).render('error', {
      title: t('err.500_title'),
      heading: t('err.500_title'),
      message: t('err.500_text'),
    });
  });

  return app;
}

module.exports = { createApp };
