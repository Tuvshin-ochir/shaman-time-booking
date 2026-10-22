const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const config = require('../config');
const { db } = require('../db');
const auth = require('../lib/auth');
const settings = require('../lib/settings');
const slots = require('../lib/slots');
const bookings = require('../lib/bookings');
const notify = require('../lib/notify');
const sms = require('../lib/sms');
const backup = require('../lib/backup');
const landing = require('../lib/landing');
const policy = require('../lib/policy');
const markdown = require('../lib/markdown');
const i18n = require('../i18n');
const { rateLimit } = require('../lib/http');
const { normalizePhone, parsePhoneList } = require('../lib/phone');
const { nowLocal, addDays, isValidDate, toMin, fromMin, localToEpoch } = require('../lib/time');

const router = express.Router();

const field = (value) => String(Array.isArray(value) ? value[0] : (value ?? '')).trim();
const checked = (value) => value === 'on' || value === '1' || value === 'true';

const MESSAGES = {
  saved: 'Хадгаллаа.',
  created: 'Захиалга нэмэгдлээ.',
  cancelled: 'Захиалгыг цуцаллаа.',
  rescheduled: 'Цагийг шилжүүллээ.',
  refunded: 'Буцаалт хийгдсэн гэж тэмдэглэлээ.',
  payment: 'Төлбөр бүртгэлээ.',
  note: 'Тэмдэглэл хадгаллаа.',
  sms: 'SMS илгээлээ. Үр дүнг доорх SMS түүхээс харна уу.',
  password: 'Нууц үг солигдлоо.',
  holiday: 'Амралтын өдөр нэмэгдлээ.',
  holiday_deleted: 'Амралтын өдрийг устгалаа.',
  image: 'Зураг шинэчлэгдлээ. Сайт дээр шууд харагдана.',
  service_deleted: 'Үйлчилгээг устгалаа. Өмнөх захиалгууд хэвээр хадгалагдана.',
};

const ERRORS = {
  name: 'Нэрээ оруулна уу (2-оос дээш тэмдэгт).',
  phone: 'Утасны дугаар буруу байна (8 оронтой гар утас).',
  date: 'Огноо буруу байна.',
  time: 'Цаг буруу байна.',
  service: 'Үйлчилгээ олдсонгүй.',
  slot_taken: 'Энэ цаг өөр захиалгатай давхцаж байна. Өөр цаг сонгох эсвэл «Давхцлыг үл тоох»-г чагтална уу.',
  not_active: 'Энэ захиалга идэвхгүй (цуцлагдсан эсвэл хугацаа дууссан) байна.',
  not_found: 'Олдсонгүй.',
  amount: 'Дүн буруу байна.',
  sms_kind: 'SMS-ийн төрөл буруу.',
};

const STATUS_LABELS = {
  pending: 'Төлбөр хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  cancelled: 'Цуцалсан',
  expired: 'Хугацаа дууссан',
};

const EVENT_LABELS = {
  created: 'Үүссэн',
  invoice_created: 'Нэхэмжлэх үүссэн',
  invoice_failed: 'Нэхэмжлэх үүсгэж чадсангүй',
  confirmed: 'Баталгаажсан',
  expired: 'Хугацаа дууссан',
  cancelled: 'Цуцалсан',
  rescheduled: 'Цаг шилжүүлсэн',
  refund_needed: 'Буцаалт шаардлагатай',
  refunded: 'Буцаалт хийгдсэн',
  manual_payment: 'Гараар төлбөр бүртгэсэн',
  partial_payment: 'Дутуу төлбөр',
  note: 'Тэмдэглэл зассан',
};

function formatTs(ms) {
  if (!ms) return '';
  const { date, minutes } = nowLocal(ms);
  return `${date.replace(/-/g, '.')} ${fromMin(minutes)}`;
}

router.use((req, res, next) => {
  Object.assign(res.locals, {
    t: i18n.translator(),
    formatDate: i18n.formatDate,
    formatTs,
    statusOf: (b) => bookings.effectiveStatus(b),
    statusLabel: (s) => STATUS_LABELS[s] || s,
    eventLabel: (e) => EVENT_LABELS[e] || e,
    flash: MESSAGES[req.query.ok] || null,
    flashError: ERRORS[req.query.err] || null,
  });
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  next();
});

// ── Login ─────────────────────────────────────────────────

const DUMMY_HASH = auth.hashPassword('timing-equaliser');

function safeNext(value) {
  const next = field(value);
  return next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  onLimit: (req, res) =>
    res.status(429).render('admin/login', {
      error: 'Хэт олон оролдлого хийлээ. 15 минутын дараа дахин оролдоно уу.',
      username: '',
    }),
});

router.get('/login', (req, res) => {
  if (auth.readSession(req.cookies[auth.COOKIE])) return res.redirect(303, '/admin');
  res.render('admin/login', { error: null, username: '' });
});

router.post('/login', loginLimiter, (req, res) => {
  const username = field(req.body.username);
  const password = String(req.body.password || '');
  const admin = auth.findAdmin(username);
  const ok = auth.verifyPassword(password, admin ? admin.password_hash : DUMMY_HASH) && !!admin;
  if (!ok) {
    return res.status(401).render('admin/login', { error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.', username });
  }
  db().prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(Date.now(), admin.id);
  res.cookie(auth.COOKIE, auth.createSession(admin), auth.cookieOptions());
  res.redirect(303, safeNext(req.query.next));
});

// Usage guide, rendered from docs/ADMIN_GUIDE.md. Public so it can be opened
// from the login page.
const GUIDE_FILE = path.join(__dirname, '..', '..', 'docs', 'ADMIN_GUIDE.md');
let guideCache = null;

router.get('/guide', (req, res) => {
  if (!guideCache || !config.isProd) guideCache = markdown.render(fs.readFileSync(GUIDE_FILE, 'utf8'));
  res.render('admin/guide', {
    pageTitle: 'Сайт ашиглах заавар',
    guide: guideCache,
    loggedIn: !!auth.readSession(req.cookies[auth.COOKIE]),
  });
});

// Everything below requires a session; POSTs also require the CSRF token.
router.use((req, res, next) => {
  const session = req.cookies[auth.COOKIE];
  const admin = auth.readSession(session);
  if (!admin) {
    if (req.method === 'GET') return res.redirect(303, `/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
    return res.status(401).send('Нэвтрэх шаардлагатай.');
  }
  const csrf = auth.csrfToken(session);
  const sentCsrf = field(req.body && req.body._csrf) || field(req.get('x-csrf-token'));
  if (req.method === 'POST' && !auth.safeEqual(sentCsrf, csrf)) {
    return res.status(403).send('Хамгаалалтын токен буруу байна. Хуудсаа дахин ачаалаад оролдоно уу.');
  }
  req.admin = admin;
  res.locals.admin = admin;
  res.locals.csrf = csrf;
  // Counters shown next to sidebar items.
  res.locals.navBadges = {
    bookings: db().prepare(`SELECT COUNT(*) AS n FROM bookings WHERE refund_status = 'pending'`).get().n,
    sms: db().prepare(`SELECT COUNT(*) AS n FROM sms_log WHERE status = 'failed' AND created_at > ?`).get(Date.now() - 7 * 86400000).n,
  };
  next();
});

router.post('/logout', (req, res) => {
  res.clearCookie(auth.COOKIE, { path: '/admin' });
  res.redirect(303, '/admin/login');
});

// ── Dashboard ─────────────────────────────────────────────

router.get('/', (req, res) => {
  const now = Date.now();
  const today = nowLocal(now).date;
  const one = (sql, ...params) => db().prepare(sql).get(...params);

  const todays = db()
    .prepare(`SELECT * FROM bookings WHERE date = ? AND ${slots.BLOCKING_SQL} ORDER BY start_min`)
    .all(today, now);
  const upcoming = db()
    .prepare(
      `SELECT * FROM bookings WHERE status = 'confirmed' AND date > ? ORDER BY date, start_min LIMIT 10`
    )
    .all(today);
  const stats = {
    today: todays.filter((b) => b.status === 'confirmed').length,
    week: one(
      `SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND date BETWEEN ? AND ?`,
      today,
      addDays(today, 6)
    ).n,
    pending: one(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending' AND hold_expires_at > ?`, now).n,
    refunds: one(`SELECT COUNT(*) AS n FROM bookings WHERE refund_status = 'pending'`).n,
    revenue: one(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'paid' AND paid_at >= ?`,
      localToEpoch(`${today.slice(0, 8)}01`, 0)
    ).s,
    smsFailed: one(`SELECT COUNT(*) AS n FROM sms_log WHERE status = 'failed' AND created_at > ?`, now - 7 * 86400000).n,
  };

  const warnings = [];
  if (config.qpay.mode === 'mock') warnings.push('QPay туршилтын (mock) горимд байна — жинхэнэ төлбөр авахгүй. .env дотор QPAY_MODE=live болгоно.');
  if (config.qpay.mode === 'sandbox') warnings.push('QPay sandbox (тест) орчинд холбогдсон байна.');
  if (config.sms.provider === 'console') warnings.push('SMS илгээгдэхгүй байна (SMS_PROVIDER=console). docs/SMS_SETUP.md-г үзнэ үү.');
  if (!parsePhoneList(settings.get('sms').staff_phones).valid.length) {
    warnings.push('Бөөгийн утасны дугаар оруулаагүй тул шинэ захиалгын SMS бөөд очихгүй. Тохиргоо → SMS.');
  }
  if (settings.get('business').address === settings.DEFAULTS.business.address) {
    warnings.push('Байгууллагын хаяг, утас анхны жишээ утгатай байна. Тохиргоо → Байгууллага.');
  }
  if (config.isProd && !config.baseUrl.startsWith('https://')) warnings.push('BASE_URL https биш байна.');

  res.render('admin/dashboard', { section: 'dashboard', today, todays, upcoming, stats, warnings });
});

// ── Bookings ──────────────────────────────────────────────

const PAGE_SIZE = 50;

function bookingQuery(query, now = Date.now()) {
  const today = nowLocal(now).date;
  const view = ['today', 'upcoming', 'past', 'date', 'all'].includes(query.view) ? query.view : 'upcoming';
  const status = ['active', 'confirmed', 'paid', 'pending', 'cancelled', 'expired', 'refund', 'all'].includes(query.status)
    ? query.status
    : 'active';
  const date = isValidDate(field(query.date)) ? field(query.date) : today;
  const q = field(query.q).slice(0, 50);
  const where = [];
  const params = [];

  if (view === 'today') {
    where.push('date = ?');
    params.push(today);
  } else if (view === 'upcoming') {
    where.push('date >= ?');
    params.push(today);
  } else if (view === 'past') {
    where.push('date < ?');
    params.push(today);
  } else if (view === 'date') {
    where.push('date = ?');
    params.push(date);
  }

  if (status === 'active') {
    where.push(slots.BLOCKING_SQL);
    params.push(now);
  } else if (status === 'confirmed') {
    where.push(`status = 'confirmed'`);
  } else if (status === 'paid') {
    where.push(`status = 'confirmed' AND paid_amount > 0`);
  } else if (status === 'pending') {
    where.push(`status = 'pending' AND hold_expires_at > ?`);
    params.push(now);
  } else if (status === 'cancelled') {
    where.push(`status = 'cancelled'`);
  } else if (status === 'expired') {
    where.push(`(status = 'expired' OR (status = 'pending' AND hold_expires_at <= ?))`);
    params.push(now);
  } else if (status === 'refund') {
    where.push(`refund_status = 'pending'`);
  }

  if (q) {
    const digits = q.replace(/\D/g, '');
    where.push(`(customer_name LIKE ? OR code LIKE ?${digits ? ' OR phone LIKE ?' : ''})`);
    params.push(`%${q}%`, `%${q.toUpperCase()}%`);
    if (digits) params.push(`%${digits}%`);
  }

  const order = view === 'past' || view === 'all' ? 'date DESC, start_min DESC' : 'date ASC, start_min ASC';
  return {
    filters: { view, status, date, q },
    sql: `FROM bookings ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    order,
    params,
  };
}

router.get('/bookings', (req, res) => {
  const { filters, sql, order, params } = bookingQuery(req.query);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const total = db().prepare(`SELECT COUNT(*) AS n ${sql}`).get(...params).n;
  const rows = db()
    .prepare(`SELECT * ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const qs = new URLSearchParams({ view: filters.view, status: filters.status, date: filters.date, q: filters.q });
  res.render('admin/bookings', {
    section: 'bookings',
    filters,
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    qs: qs.toString(),
  });
});

function csvCell(value) {
  const s = String(value ?? '');
  // Leading = + - @ would be treated as formulas by Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

router.get('/bookings.csv', (req, res) => {
  const { sql, order, params } = bookingQuery(req.query);
  const rows = db().prepare(`SELECT * ${sql} ORDER BY ${order}`).all(...params);
  const header = ['Код', 'Огноо', 'Цаг', 'Үйлчилгээ', 'Нэр', 'Утас', 'Төлөв', 'Үнэ', 'Төлсөн', 'Буцаалт', 'Эх сурвалж', 'Тайлбар'];
  const lines = rows.map((b) =>
    [
      b.code,
      b.date,
      fromMin(b.start_min),
      b.service_name,
      b.customer_name,
      b.phone,
      STATUS_LABELS[bookings.effectiveStatus(b)],
      b.price,
      b.paid_amount,
      b.refund_status || '',
      b.source,
      b.note || '',
    ]
      .map(csvCell)
      .join(',')
  );
  res
    .type('text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="bookings-${nowLocal().date}.csv"`)
    .send(`﻿${[header.join(','), ...lines].join('\r\n')}\r\n`);
});

function allServices() {
  return db().prepare('SELECT * FROM services WHERE deleted_at IS NULL ORDER BY active DESC, sort, id').all();
}

router.get('/bookings/new', (req, res) => {
  const date = isValidDate(field(req.query.date)) ? field(req.query.date) : nowLocal().date;
  res.render('admin/booking-new', {
    section: 'bookings',
    services: allServices(),
    form: { date, notify: 'on' },
    error: null,
  });
});

router.post('/bookings/new', async (req, res) => {
  const form = {
    service_id: field(req.body.service_id),
    date: field(req.body.date),
    time: field(req.body.time),
    name: field(req.body.name),
    phone: field(req.body.phone),
    note: field(req.body.note),
    paid_amount: field(req.body.paid_amount),
    force: req.body.force,
    notify: req.body.notify,
  };
  try {
    const booking = bookings.createManual({
      serviceId: form.service_id,
      date: form.date,
      time: form.time,
      name: form.name,
      phone: form.phone,
      note: form.note,
      paidAmount: form.paid_amount,
      force: checked(form.force),
      actor: req.admin.username,
    });
    if (checked(form.notify)) await notify.bookingConfirmed(booking);
    res.redirect(303, `/admin/bookings/${booking.id}?ok=created`);
  } catch (err) {
    if (!(err instanceof bookings.BookingError)) throw err;
    res.status(422).render('admin/booking-new', {
      section: 'bookings',
      services: allServices(),
      form,
      error: ERRORS[err.code] || err.message,
    });
  }
});

router.get('/bookings/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const booking = bookings.getById(id);
  if (!booking) return next();
  res.render('admin/booking', {
    section: 'bookings',
    booking,
    status: bookings.effectiveStatus(booking),
    payments: db().prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC').all(id),
    events: db().prepare('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY id DESC').all(id),
    smsLog: db().prepare('SELECT * FROM sms_log WHERE booking_id = ? ORDER BY id DESC').all(id),
    today: nowLocal().date,
  });
});

// Wraps a booking action: redirects back with ?ok=<result> or ?err=<code>.
function action(handler) {
  return async (req, res) => {
    const id = Number(req.params.id);
    try {
      const ok = await handler(req, id);
      res.redirect(303, `/admin/bookings/${id}?ok=${ok}`);
    } catch (err) {
      if (!(err instanceof bookings.BookingError)) throw err;
      res.redirect(303, `/admin/bookings/${id}?err=${encodeURIComponent(err.code)}`);
    }
  };
}

router.post(
  '/bookings/:id/cancel',
  action(async (req, id) => {
    const booking = await bookings.cancel(id, {
      reason: field(req.body.reason),
      refund: checked(req.body.refund),
      actor: req.admin.username,
    });
    if (checked(req.body.notify)) await notify.bookingCancelled(booking);
    return 'cancelled';
  })
);

router.post(
  '/bookings/:id/reschedule',
  action(async (req, id) => {
    const booking = bookings.reschedule(id, {
      date: field(req.body.date),
      time: field(req.body.time),
      force: checked(req.body.force),
      actor: req.admin.username,
    });
    if (checked(req.body.notify) && booking.status === 'confirmed') await notify.bookingRescheduled(booking);
    return 'rescheduled';
  })
);

router.post(
  '/bookings/:id/refunded',
  action(async (req, id) => {
    bookings.markRefunded(id, { actor: req.admin.username });
    return 'refunded';
  })
);

router.post(
  '/bookings/:id/payment',
  action(async (req, id) => {
    bookings.recordManualPayment(id, {
      amount: field(req.body.amount),
      note: field(req.body.note),
      actor: req.admin.username,
    });
    return 'payment';
  })
);

router.post(
  '/bookings/:id/note',
  action(async (req, id) => {
    if (!bookings.getById(id)) throw new bookings.BookingError('not_found');
    bookings.setAdminNote(id, req.body.admin_note, req.admin.username);
    return 'note';
  })
);

router.post(
  '/bookings/:id/sms',
  action(async (req, id) => {
    const booking = bookings.getById(id);
    if (!booking) throw new bookings.BookingError('not_found');
    const kind = field(req.body.kind);
    if (kind === 'confirm') await notify.bookingConfirmed(booking);
    else if (kind === 'reminder') await notify.reminder(booking);
    else if (kind === 'reschedule') await notify.bookingRescheduled(booking);
    else if (kind === 'cancel') await notify.bookingCancelled(booking);
    else throw new bookings.BookingError('sms_kind');
    return 'sms';
  })
);

// Free start times for the admin forms (no lead-time / booking-window limits).
router.get('/api/slots', (req, res) => {
  const date = field(req.query.date);
  if (!isValidDate(date)) return res.status(400).json({ error: 'date' });
  let duration;
  let excludeId = 0;
  if (req.query.booking) {
    const booking = bookings.getById(Number(req.query.booking));
    if (!booking) return res.status(404).json({ error: 'booking' });
    duration = booking.end_min - booking.start_min;
    excludeId = booking.id;
  } else {
    const service = bookings.getService(field(req.query.service), { activeOnly: false });
    if (!service) return res.status(404).json({ error: 'service' });
    duration = service.duration_min;
  }
  const hours = slots.hoursFor(date);
  res.json({
    closed: !hours,
    times: slots.availableTimes({ duration_min: duration }, date, { admin: true, excludeId }).map(fromMin),
  });
});

// ── Schedule & holidays ───────────────────────────────────

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function renderSchedule(res, { schedule = settings.get('schedule'), errors = [] } = {}) {
  const today = nowLocal().date;
  res.status(errors.length ? 422 : 200).render('admin/schedule', {
    section: 'schedule',
    schedule,
    errors,
    weekOrder: WEEK_ORDER,
    dayNames: i18n.DAY_NAMES,
    holidays: db().prepare('SELECT * FROM holidays WHERE date >= ? ORDER BY date').all(addDays(today, -30)),
    today,
  });
}

router.get('/schedule', (req, res) => renderSchedule(res));

function intInRange(value, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

router.post('/schedule', (req, res) => {
  const names = i18n.DAY_NAMES;
  const errors = [];
  const weekly = [];
  for (let wd = 0; wd < 7; wd++) {
    const day = {
      open: checked(req.body[`open_${wd}`]),
      start: field(req.body[`start_${wd}`]),
      end: field(req.body[`end_${wd}`]),
      break_start: field(req.body[`break_start_${wd}`]),
      break_end: field(req.body[`break_end_${wd}`]),
    };
    if (day.open) {
      if (!(toMin(day.start) < toMin(day.end))) errors.push(`${names[wd]}: эхлэх цаг дуусах цагаас өмнө байх ёстой.`);
      if (day.break_start || day.break_end) {
        const bs = toMin(day.break_start);
        const be = toMin(day.break_end);
        if (!(bs < be) || bs < toMin(day.start) || be > toMin(day.end)) {
          errors.push(`${names[wd]}: цайны цаг ажлын цаг дотор, эхлэх < дуусах байх ёстой.`);
        }
      }
    }
    weekly.push(day);
  }
  const numbers = {
    slot_minutes: [intInRange(req.body.slot_minutes, 5, 240), 'Цагийн алхам 5–240 минут байна.'],
    lead_minutes: [intInRange(req.body.lead_minutes, 0, 7 * 24 * 60), 'Хамгийн бага урьдчилах хугацаа буруу.'],
    window_days: [intInRange(req.body.window_days, 1, 365), 'Захиалга авах хоног 1–365 байна.'],
    hold_minutes: [intInRange(req.body.hold_minutes, 5, 60), 'Цаг барих хугацаа 5–60 минут байна.'],
    capacity: [intInRange(req.body.capacity, 1, 50), 'Зэрэг үйлчлэх тоо 1–50 байна.'],
  };
  const schedule = { weekly };
  for (const [key, [value, message]] of Object.entries(numbers)) {
    if (value === null) errors.push(message);
    schedule[key] = value ?? field(req.body[key]);
  }
  if (errors.length) return renderSchedule(res, { schedule, errors });
  settings.set('schedule', schedule);
  res.redirect(303, '/admin/schedule?ok=saved');
});

router.post('/holidays', (req, res) => {
  const from = field(req.body.date_from);
  const to = field(req.body.date_to) || from;
  if (!isValidDate(from) || !isValidDate(to) || to < from || addDays(from, 92) < to) {
    return res.redirect(303, '/admin/schedule?err=date');
  }
  const note = field(req.body.note).slice(0, 100) || null;
  const insert = db().prepare(
    'INSERT INTO holidays (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note'
  );
  for (let d = from; d <= to; d = addDays(d, 1)) insert.run(d, note);
  res.redirect(303, '/admin/schedule?ok=holiday');
});

router.post('/holidays/:date/delete', (req, res) => {
  db().prepare('DELETE FROM holidays WHERE date = ?').run(field(req.params.date));
  res.redirect(303, '/admin/schedule?ok=holiday_deleted');
});

// ── Services ──────────────────────────────────────────────

// Confirmed or held future bookings per service, shown before deleting.
function upcomingCounts() {
  const rows = db()
    .prepare(`SELECT service_id, COUNT(*) AS n FROM bookings WHERE date >= ? AND ${slots.BLOCKING_SQL} GROUP BY service_id`)
    .all(nowLocal().date, Date.now());
  return Object.fromEntries(rows.map((r) => [r.service_id, r.n]));
}

router.get('/services', (req, res) => {
  res.render('admin/services', { section: 'services', services: allServices(), upcoming: upcomingCounts() });
});

function serviceForm(body) {
  const form = {
    name: field(body.name).slice(0, 100),
    description: field(body.description).slice(0, 1000),
    price: field(body.price).replace(/[\s,]/g, ''),
    deposit: field(body.deposit).replace(/[\s,]/g, ''),
    duration_min: field(body.duration_min),
    sort: field(body.sort) || '0',
    active: checked(body.active) ? 1 : 0,
  };
  const errors = [];
  if (form.name.length < 2) errors.push('Нэр оруулна уу.');
  const price = intInRange(form.price, 0, 100000000);
  if (price === null) errors.push('Үнэ буруу байна.');
  let deposit = null;
  if (form.deposit !== '') {
    deposit = intInRange(form.deposit, 0, 100000000);
    if (deposit === null || (price !== null && deposit > price)) errors.push('Урьдчилгаа 0-ээс үнэ хүртэл байна.');
  }
  const duration = intInRange(form.duration_min, 5, 600);
  if (duration === null) errors.push('Үргэлжлэх хугацаа 5–600 минут байна.');
  const sort = intInRange(form.sort, -1000, 1000) ?? 0;
  return {
    form,
    errors,
    values: [form.name, form.description || null, price, deposit, duration, form.active, sort],
  };
}

router.get('/services/new', (req, res) => {
  res.render('admin/service-form', { section: 'services', service: null, form: { active: 1, sort: '0' }, errors: [] });
});

router.post('/services/new', (req, res) => {
  const { form, errors, values } = serviceForm(req.body);
  if (errors.length) return res.status(422).render('admin/service-form', { section: 'services', service: null, form, errors });
  db()
    .prepare(
      `INSERT INTO services (name, description, price, deposit, duration_min, active, sort, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values, Date.now());
  res.redirect(303, '/admin/services?ok=saved');
});

router.get('/services/:id', (req, res, next) => {
  const service = bookings.getService(req.params.id, { activeOnly: false });
  if (!service) return next();
  const form = { ...service, deposit: service.deposit ?? '' };
  res.render('admin/service-form', { section: 'services', service, form, errors: [], upcoming: upcomingCounts()[service.id] || 0 });
});

// Services that were ever booked are only hidden (deleted_at) so old bookings keep their history.
router.post('/services/:id/delete', (req, res, next) => {
  const service = bookings.getService(req.params.id, { activeOnly: false });
  if (!service) return next();
  const booked = db().prepare('SELECT COUNT(*) AS n FROM bookings WHERE service_id = ?').get(service.id).n;
  if (booked) {
    db().prepare('UPDATE services SET deleted_at = ?, active = 0 WHERE id = ?').run(Date.now(), service.id);
  } else {
    db().prepare('DELETE FROM services WHERE id = ?').run(service.id);
  }
  res.redirect(303, '/admin/services?ok=service_deleted');
});

router.post('/services/:id', (req, res, next) => {
  const service = bookings.getService(req.params.id, { activeOnly: false });
  if (!service) return next();
  const { form, errors, values } = serviceForm(req.body);
  if (errors.length) return res.status(422).render('admin/service-form', { section: 'services', service, form, errors });
  db()
    .prepare(
      `UPDATE services SET name = ?, description = ?, price = ?, deposit = ?, duration_min = ?, active = ?, sort = ?
         WHERE id = ?`
    )
    .run(...values, service.id);
  res.redirect(303, '/admin/services?ok=saved');
});

// ── Settings ──────────────────────────────────────────────

function renderSettings(res, { errors = [], tab = null } = {}) {
  res.status(errors.length ? 422 : 200).render('admin/settings', {
    section: 'settings',
    business: settings.get('business'),
    content: settings.get('content'),
    smsSettings: settings.get('sms'),
    errors,
    tab,
    env: {
      baseUrl: config.baseUrl,
      qpayMode: config.qpay.mode,
      smsProvider: config.sms.provider,
      smsSender: config.sms.sender,
      dataDir: config.dataDir,
      backupKeep: config.backupKeep,
    },
  });
}

router.get('/settings', (req, res) => renderSettings(res));

router.post('/settings/business', (req, res) => {
  const keys = Object.keys(settings.DEFAULTS.business);
  const value = Object.fromEntries(keys.map((k) => [k, field(req.body[k]).slice(0, 300)]));
  const errors = [];
  if (!value.name) errors.push('Байгууллагын нэр оруулна уу.');
  for (const key of ['map_url', 'facebook_url']) {
    if (value[key] && !/^https?:\/\//i.test(value[key])) errors.push(`${key}: http(s):// -ээр эхэлсэн холбоос оруулна уу.`);
  }
  if (errors.length) return renderSettings(res, { errors });
  settings.set('business', value);
  res.redirect(303, '/admin/settings?ok=saved');
});

router.post('/settings/content', (req, res) => {
  const content = { ...settings.get('content') };
  for (const key of Object.keys(settings.DEFAULTS.content)) {
    if (key in req.body) content[key] = String(req.body[key] ?? '').trim().slice(0, 10000);
  }
  settings.set('content', content);
  res.redirect(303, '/admin/settings?ok=saved#content');
});

// ── Home page editor ──────────────────────────────────────

const DEFAULT_TEXT = i18n.translator();

function renderLanding(res, { error = null, status = 200 } = {}) {
  res.status(status).render('admin/landing', {
    section: 'landing',
    sections: landing.SECTIONS,
    slots: landing.IMAGE_SLOTS,
    gallery: landing.gallery(),
    gallerySizes: landing.GALLERY_SIZES,
    galleryMax: landing.GALLERY_MAX,
    value: (f) => landing.fieldValue(f, DEFAULT_TEXT) ?? '',
    image: landing.image,
    isCustom: landing.isCustomImage,
    policy: policy.get(),
    policyTones: policy.TONES,
    policyMax: { highlight: policy.MAX_HIGHLIGHTS, section: policy.MAX_SECTIONS },
    error,
  });
}

router.get('/landing', (req, res) => renderLanding(res));

router.post('/landing', (req, res) => {
  try {
    landing.saveTexts(req.body, DEFAULT_TEXT);
    policy.save(req.body);
  } catch (err) {
    if (!(err instanceof landing.LandingError)) throw err;
    return renderLanding(res, { error: err.message, status: 422 });
  }
  res.redirect(303, '/admin/landing?ok=saved');
});

// JSON endpoints used by public/assets/js/admin.js
function jsonAction(handler) {
  return async (req, res) => {
    try {
      await handler(req.body || {});
      res.json({ ok: true });
    } catch (err) {
      if (!(err instanceof landing.LandingError)) throw err;
      res.status(400).json({ error: err.message });
    }
  };
}

router.post(
  '/landing/image',
  jsonAction((b) => (b.slot === 'gallery' ? landing.setGalleryImage(b.index, b) : landing.setImage(b.slot, b)))
);
router.post('/landing/image/reset', jsonAction((b) => landing.resetImage(b.slot)));
router.post('/landing/gallery/delete', jsonAction((b) => landing.deleteGalleryImage(b.index)));
router.post('/landing/gallery/move', jsonAction((b) => landing.moveGalleryImage(b.index, b.direction)));
router.post('/landing/gallery/reset', jsonAction(() => landing.resetGallery()));

router.post('/settings/sms', (req, res) => {
  const { valid, invalid } = parsePhoneList(req.body.staff_phones);
  if (invalid.length) return renderSettings(res, { errors: [`Буруу дугаар: ${invalid.join(', ')}`] });
  const templates = {};
  for (const key of Object.keys(settings.DEFAULTS.sms.templates)) {
    templates[key] = field(req.body[`tpl_${key}`]).slice(0, 500) || settings.DEFAULTS.sms.templates[key];
  }
  settings.set('sms', {
    staff_phones: valid.join(', '),
    reminders: checked(req.body.reminders),
    transliterate: checked(req.body.transliterate),
    templates,
  });
  res.redirect(303, '/admin/settings?ok=saved#sms');
});

router.post('/settings/sms-test', async (req, res) => {
  const phone = normalizePhone(field(req.body.phone));
  if (!phone) return res.redirect(303, '/admin/settings?err=phone#sms');
  await sms.send(phone, `${settings.get('business').name}: Туршилтын SMS. Тохиргоо зөв байна.`, { kind: 'test' });
  res.redirect(303, '/admin/sms?ok=sms');
});

router.post('/settings/password', (req, res) => {
  const current = String(req.body.current || '');
  const next = String(req.body.new_password || '');
  const errors = [];
  if (!auth.verifyPassword(current, req.admin.password_hash)) errors.push('Одоогийн нууц үг буруу.');
  if (next.length < 10) errors.push('Шинэ нууц үг хамгийн багадаа 10 тэмдэгт байна.');
  if (next !== String(req.body.confirm || '')) errors.push('Шинэ нууц үг таарахгүй байна.');
  if (errors.length) return renderSettings(res, { errors });
  auth.setPassword(req.admin.username, next);
  const admin = auth.findAdmin(req.admin.username);
  res.cookie(auth.COOKIE, auth.createSession(admin), auth.cookieOptions());
  res.redirect(303, '/admin/settings?ok=password');
});

// ── Payments, SMS log, backup ─────────────────────────────

router.get('/payments', (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const status = ['paid', 'created', 'cancelled'].includes(req.query.status) ? req.query.status : '';
  const where = status ? 'WHERE p.status = ?' : '';
  const params = status ? [status] : [];
  const total = db().prepare(`SELECT COUNT(*) AS n FROM payments p ${where}`).get(...params).n;
  const rows = db()
    .prepare(
      `SELECT p.*, b.code, b.customer_name, b.phone, b.date, b.start_min
       FROM payments p JOIN bookings b ON b.id = p.booking_id ${where}
       ORDER BY p.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  res.render('admin/payments', {
    section: 'payments',
    rows,
    status,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
});

router.get('/sms', (req, res) => {
  const rows = db()
    .prepare(
      `SELECT s.*, b.code FROM sms_log s LEFT JOIN bookings b ON b.id = s.booking_id ORDER BY s.id DESC LIMIT 200`
    )
    .all();
  res.render('admin/sms', { section: 'sms', rows });
});

router.post('/sms/:id/resend', async (req, res, next) => {
  const row = db().prepare('SELECT * FROM sms_log WHERE id = ?').get(Number(req.params.id));
  if (!row) return next();
  await sms.send(row.to_phone, row.body, { bookingId: row.booking_id, kind: row.kind });
  res.redirect(303, '/admin/sms?ok=sms');
});

router.get('/backup', async (req, res) => {
  const now = nowLocal();
  const name = `backup-${now.date}-${fromMin(now.minutes).replace(':', '')}.db`;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'booking-')), name);
  await backup.createBackup(tmp);
  res.download(tmp, name, () => fs.rm(path.dirname(tmp), { recursive: true, force: true }, () => {}));
});

module.exports = router;
