const express = require('express');
const config = require('../config');
const { db } = require('../db');
const settings = require('../lib/settings');
const slots = require('../lib/slots');
const bookings = require('../lib/bookings');
const qpay = require('../lib/qpay');
const i18n = require('../i18n');
const { rateLimit } = require('../lib/http');
const { isValidDate, fromMin, localToEpoch } = require('../lib/time');

const router = express.Router();

const field = (value) => String(Array.isArray(value) ? value[0] : (value ?? '')).trim();

function bookingServices() {
  return db()
    .prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id')
    .all()
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: s.price,
      amountDue: bookings.amountDue(s),
      duration: s.duration_min,
    }));
}

function renderBook(req, res, { form = {}, error = null, status = 200 } = {}) {
  const t = res.locals.t;
  const services = bookingServices();
  const holdMinutes = settings.get('schedule').hold_minutes;
  // Data for public/assets/js/book.js; "<" is escaped so it is safe inside <script>.
  const bootstrap = JSON.stringify({
    services,
    form,
    strings: {
      loading: t('book.loading'),
      noTimes: t('book.no_times'),
      noDays: t('book.no_days'),
      closed: t('book.closed'),
      full: t('book.full'),
      free: t('book.free'),
      errPhone: t('err.phone'),
      errName: t('err.name'),
      errTime: t('book.select_time_first'),
      errAgree: t('err.agree'),
      errGeneric: t('err.generic'),
      submit: t('book.submit'),
      submitFree: t('book.submit_free'),
      duration: t('services.duration'),
    },
  }).replace(/</g, '\\u003c');
  res.status(status).render('book', {
    page: 'book',
    title: t('book.title'),
    services,
    form,
    error,
    holdMinutes,
    bootstrap,
    showStickyCta: false,
  });
}

function privatePage(res) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
}

const bookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  onLimit: (req, res) =>
    renderBook(req, res, { form: req.body || {}, error: res.locals.t('err.rate'), status: 429 }),
});
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

// ── Booking form ──────────────────────────────────────────

router.get('/book', (req, res) => {
  renderBook(req, res, {
    form: { service_id: field(req.query.service), date: field(req.query.date), time: field(req.query.time) },
  });
});

router.post('/book', bookLimiter, async (req, res) => {
  const t = res.locals.t;
  const body = req.body || {};
  const form = {
    service_id: field(body.service_id),
    date: field(body.date),
    time: field(body.time),
    name: field(body.name),
    phone: field(body.phone),
    note: field(body.note),
  };
  if (!body.agree) return renderBook(req, res, { form, error: t('err.agree'), status: 422 });

  try {
    const booking = bookings.createHold({
      serviceId: form.service_id,
      date: form.date,
      time: form.time,
      name: form.name,
      phone: form.phone,
      note: form.note,
      ip: req.ip,
    });
    const result = await bookings.startPayment(booking);
    const target = result.booking.status === 'confirmed' ? 'booking' : 'pay';
    return res.redirect(303, `/${target}/${booking.token}`);
  } catch (err) {
    if (!(err instanceof bookings.BookingError)) throw err;
    if (err.code === 'slot_taken') form.time = '';
    return renderBook(req, res, { form, error: t(`err.${err.code}`) || t('err.generic'), status: 422 });
  }
});

// ── Availability API (used by book.js) ────────────────────

router.get('/api/days', apiLimiter, (req, res) => {
  const service = bookings.getService(field(req.query.service));
  if (!service) return res.status(404).json({ error: 'service' });
  const days = slots.availableDays(service).map((d) => ({ ...d, ...i18n.dateParts(d.date) }));
  res.set('Cache-Control', 'no-store').json({ days });
});

router.get('/api/slots', apiLimiter, (req, res) => {
  const service = bookings.getService(field(req.query.service));
  const date = field(req.query.date);
  if (!service) return res.status(404).json({ error: 'service' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'date' });
  res.set('Cache-Control', 'no-store').json({
    date,
    label: i18n.formatDate(date),
    times: slots.availableTimes(service, date).map(fromMin),
  });
});

// ── Payment ───────────────────────────────────────────────

function latestInvoice(bookingId) {
  return (
    db()
      .prepare(`SELECT * FROM payments WHERE booking_id = ? AND invoice_id IS NOT NULL ORDER BY id DESC LIMIT 1`)
      .get(bookingId) || null
  );
}

router.get('/pay/:token', (req, res, next) => {
  const booking = bookings.getByToken(req.params.token);
  if (!booking) return next();
  privatePage(res);
  const status = bookings.effectiveStatus(booking);
  if (status === 'confirmed') return res.redirect(303, `/booking/${booking.token}`);

  const payment = status === 'pending' ? latestInvoice(booking.id) : null;
  let deeplinks = [];
  try {
    deeplinks = payment && payment.deeplinks ? JSON.parse(payment.deeplinks) : [];
  } catch {
    deeplinks = [];
  }
  res.render('pay', {
    page: 'pay',
    title: res.locals.t('pay.title'),
    booking,
    status,
    payment,
    deeplinks: deeplinks.filter((d) => d && /^[a-z][a-z0-9+.-]*:/i.test(d.link || '')),
    serverNow: Date.now(),
    showStickyCta: false,
  });
});

router.get('/api/booking/:token/status', apiLimiter, async (req, res) => {
  let booking = bookings.getByToken(req.params.token);
  if (!booking) return res.status(404).json({ error: 'not_found' });
  // Check even when the hold just ran out: the customer may have paid in the last seconds.
  if (booking.status === 'pending') {
    try {
      booking = await bookings.checkPayment(booking, { minIntervalMs: req.query.force ? 1000 : 3000 });
    } catch (err) {
      console.error(`[qpay] status check for booking ${booking.id} failed: ${err.message}`);
    }
  }
  res.set('Cache-Control', 'no-store').json({
    status: bookings.effectiveStatus(booking),
    expiresAt: booking.hold_expires_at,
    now: Date.now(),
  });
});

// QPay calls this after a payment. Its content is not trusted: we look the
// booking up by its secret token and ask QPay for the real payment status.
router.all('/qpay/callback', async (req, res) => {
  const booking = bookings.getByToken(field(req.query.b));
  if (booking) {
    try {
      await bookings.checkPayment(booking, { minIntervalMs: 0, includeCancelled: true });
    } catch (err) {
      console.error(`[qpay] callback check for booking ${booking.id} failed: ${err.message}`);
    }
  }
  res.status(200).type('text/plain').send('SUCCESS');
});

// Development only: QPAY_MODE=mock lets you "pay" without QPay.
router.post('/mock/pay/:token', async (req, res, next) => {
  if (!qpay.isMock()) return next();
  const booking = bookings.getByToken(req.params.token);
  if (!booking) return next();
  const payment = latestInvoice(booking.id);
  if (payment && qpay.mockPay(payment.invoice_id)) {
    await bookings.checkPayment(booking, { minIntervalMs: 0 });
  }
  res.redirect(303, `/booking/${booking.token}`);
});

// ── Booking status page ───────────────────────────────────

router.get('/booking/:token', (req, res, next) => {
  const booking = bookings.getByToken(req.params.token);
  if (!booking) return next();
  privatePage(res);
  const status = bookings.effectiveStatus(booking);
  res.render('booking', {
    page: 'booking',
    title: res.locals.t(`booking.title_${status}`),
    booking,
    status,
    showStickyCta: status !== 'confirmed' && status !== 'pending',
  });
});

function icsText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsTime(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

router.get('/booking/:token/calendar.ics', (req, res, next) => {
  const booking = bookings.getByToken(req.params.token);
  if (!booking || booking.status !== 'confirmed') return next();
  const business = settings.get('business');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//time-booking//MN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.code}@${new URL(config.baseUrl).hostname}`,
    `DTSTAMP:${icsTime(Date.now())}`,
    `DTSTART:${icsTime(localToEpoch(booking.date, booking.start_min))}`,
    `DTEND:${icsTime(localToEpoch(booking.date, booking.end_min))}`,
    `SUMMARY:${icsText(`${booking.service_name} — ${business.name}`)}`,
    `LOCATION:${icsText(business.address)}`,
    `DESCRIPTION:${icsText(`${booking.code} · ${business.phone}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(booking.service_name)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  privatePage(res);
  res
    .type('text/calendar; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="booking-${booking.code}.ics"`)
    .send(lines.join('\r\n'));
});

module.exports = router;
