import crypto from 'node:crypto';
import { shared } from './shared.js';
import config from '../config.js';
import { db, tx } from '../db.js';
import * as settings from './settings.js';
import * as slots from './slots.js';
import * as qpay from './qpay.js';
import * as notify from './notify.js';
import { normalizePhone } from './phone.js';
import { isValidDate, toMin, fromMin, nowLocal, addDays, localToEpoch, DAY_MS } from './time.js';

class BookingError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I

function newCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

function logEvent(bookingId, type, detail = null, actor = 'system') {
  db()
    .prepare('INSERT INTO booking_events (booking_id, type, detail, actor, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(bookingId, type, detail, actor, Date.now());
}

function getById(id) {
  return db().prepare('SELECT * FROM bookings WHERE id = ?').get(id) || null;
}

function getByToken(token) {
  if (typeof token !== 'string' || token.length < 10) return null;
  return db().prepare('SELECT * FROM bookings WHERE token = ?').get(token) || null;
}

// Pending holds whose time ran out are shown as expired even before the sweep job runs.
function effectiveStatus(booking, now = Date.now()) {
  if (booking.status === 'pending' && booking.hold_expires_at <= now) return 'expired';
  return booking.status;
}

function getService(id, { activeOnly = true } = {}) {
  const service = db().prepare('SELECT * FROM services WHERE id = ?').get(Number(id)) || null;
  if (!service || service.deleted_at || (activeOnly && !service.active)) return null;
  return service;
}

function amountDue(service) {
  return service.deposit !== null && service.deposit !== undefined ? Math.min(service.deposit, service.price) : service.price;
}

function cleanName(name) {
  const value = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (value.length < 2) throw new BookingError('name');
  return value;
}

function cleanNote(note) {
  const value = String(note || '').trim().slice(0, 500);
  return value || null;
}

function parseSlot(date, time) {
  if (!isValidDate(date)) throw new BookingError('date');
  const start = toMin(time);
  if (Number.isNaN(start)) throw new BookingError('time');
  return start;
}

// "2026-10-30 14:00", or just the date for a day-only booking (logs, invoices).
function whenText(booking) {
  return booking.day_only ? booking.date : `${booking.date} ${fromMin(booking.start_min)}`;
}

function insertBooking(fields) {
  const now = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    if (db().prepare('SELECT 1 FROM bookings WHERE code = ?').get(code)) continue;
    const row = {
      code,
      token: crypto.randomBytes(18).toString('base64url'),
      note: null,
      source: 'web',
      hold_expires_at: null,
      paid_amount: 0,
      paid_at: null,
      confirmed_at: null,
      ip: null,
      ...fields,
      created_at: now,
      updated_at: now,
    };
    const columns = Object.keys(row);
    const info = db()
      .prepare(`INSERT INTO bookings (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...columns.map((c) => row[c]));
    return getById(Number(info.lastInsertRowid));
  }
  throw new Error('Could not generate a unique booking code');
}

function openInvoices(bookingId, { includeCancelled = false } = {}) {
  const statuses = includeCancelled ? `('created', 'cancelled')` : `('created')`;
  return db()
    .prepare(
      `SELECT * FROM payments WHERE booking_id = ? AND status IN ${statuses} AND invoice_id IS NOT NULL ORDER BY id DESC`
    )
    .all(bookingId);
}

// Best effort: an invoice that is cancelled at QPay can no longer be paid. If
// the cancel call fails the invoice stays 'created' so a later payment is still seen.
async function cancelOpenInvoices(bookingId) {
  for (const payment of openInvoices(bookingId)) {
    try {
      await qpay.cancelInvoice(payment.invoice_id);
    } catch (err) {
      console.error(`[qpay] cancel invoice ${payment.invoice_id} failed: ${err.message}`);
      continue;
    }
    db()
      .prepare(`UPDATE payments SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'created'`)
      .run(Date.now(), payment.id);
  }
}

// ── Customer flow ─────────────────────────────────────────

// Reserves a slot for `hold_minutes` while the customer pays. Availability is
// re-checked inside an IMMEDIATE transaction so two customers can never hold
// the same slot.
function createHold({ serviceId, date, time, name, phone, note, ip = null, now = Date.now() }) {
  const customerName = cleanName(name);
  const customerPhone = normalizePhone(phone);
  if (!customerPhone) throw new BookingError('phone');
  if (!isValidDate(date)) throw new BookingError('date');

  const released = [];
  const booking = tx(() => {
    const service = getService(serviceId);
    if (!service) throw new BookingError('service');
    // Special services are booked for a day; the time is not asked.
    const dayOnly = slots.isSpecial(service);
    const start = dayOnly ? 0 : parseSlot(date, time);

    // One unpaid hold per phone number: choosing a new time releases the old one.
    const previous = db()
      .prepare(`SELECT id FROM bookings WHERE phone = ? AND status = 'pending' AND hold_expires_at > ?`)
      .all(customerPhone, now);
    for (const { id } of previous) {
      db().prepare(`UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ?`).run(now, id);
      logEvent(id, 'expired', 'Шинэ захиалга үүсгэсэн тул хуучин барьсан цагийг суллав');
      released.push(id);
    }

    if (dayOnly) {
      if (!slots.dayIsBookable(date, { now })) throw new BookingError('day_closed');
    } else if (!slots.availableTimes(service, date, { now }).includes(start)) {
      throw new BookingError('slot_taken');
    }

    const holdMinutes = settings.get('schedule').hold_minutes;
    const created = insertBooking({
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      amount_due: amountDue(service),
      date,
      start_min: start,
      end_min: dayOnly ? 0 : start + service.duration_min,
      day_only: dayOnly ? 1 : 0,
      customer_name: customerName,
      phone: customerPhone,
      note: cleanNote(note),
      status: 'pending',
      hold_expires_at: now + holdMinutes * 60000,
      ip,
    });
    logEvent(created.id, 'created', `${whenText(created)}, ${holdMinutes} мин барьсан`, 'customer');
    return created;
  });

  for (const id of released) cancelOpenInvoices(id).catch((err) => console.error('[qpay]', err));
  return booking;
}

// Creates the QPay invoice for a pending booking. If QPay is unreachable the
// hold is released so the slot does not stay blocked.
async function startPayment(booking) {
  if (booking.amount_due <= 0) {
    const res = applyConfirmation(booking.id, { amount: 0, detail: 'Урьдчилгаа төлбөргүй үйлчилгээ' });
    if (res.outcome === 'confirmed') notify.bookingConfirmed(res.booking).catch((err) => console.error('[notify]', err));
    return { booking: res.booking, payment: null };
  }
  const business = settings.get('business');
  const senderInvoiceNo = `${booking.code}-${Date.now().toString(36)}`.toUpperCase();
  let invoice;
  try {
    invoice = await qpay.createInvoice({
      senderInvoiceNo,
      amount: booking.amount_due,
      description: `${business.name}: ${booking.service_name}, ${whenText(booking)} (${booking.code})`.slice(0, 250),
      callbackUrl: `${config.baseUrl}/qpay/callback?b=${encodeURIComponent(booking.token)}`,
      receiverCode: booking.phone,
    });
  } catch (err) {
    console.error(`[qpay] create invoice for booking ${booking.id} failed: ${err.message}`);
    db()
      .prepare(`UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending'`)
      .run(Date.now(), booking.id);
    logEvent(booking.id, 'invoice_failed', String(err.message).slice(0, 300));
    throw new BookingError('payment_unavailable');
  }

  const now = Date.now();
  const info = db()
    .prepare(
      `INSERT INTO payments (booking_id, provider, invoice_id, sender_invoice_no, amount, status,
         qr_image, qr_text, short_url, deeplinks, raw, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      booking.id,
      qpay.isMock() ? 'mock' : 'qpay',
      invoice.invoiceId,
      senderInvoiceNo,
      booking.amount_due,
      invoice.qrImage,
      invoice.qrText,
      invoice.shortUrl,
      JSON.stringify(invoice.deeplinks),
      JSON.stringify(invoice.raw),
      now,
      now
    );
  logEvent(booking.id, 'invoice_created', `QPay нэхэмжлэх ${invoice.invoiceId}`);
  return { booking, payment: db().prepare('SELECT * FROM payments WHERE id = ?').get(Number(info.lastInsertRowid)) };
}

// Marks a booking confirmed (or, if it can no longer be honoured, flags a refund).
// Returns { outcome: 'confirmed' | 'already' | 'refund', booking }.
function applyConfirmation(bookingId, { amount, actor = 'system', detail = null, now = Date.now() }) {
  return tx(() => {
    const booking = getById(bookingId);
    const confirm = (eventDetail) => {
      db()
        .prepare(
          `UPDATE bookings SET status = 'confirmed', paid_amount = paid_amount + ?, paid_at = CASE WHEN ? > 0 THEN ? ELSE paid_at END,
             confirmed_at = ?, hold_expires_at = NULL, updated_at = ? WHERE id = ?`
        )
        .run(amount, amount, now, now, now, bookingId);
      logEvent(bookingId, 'confirmed', eventDetail, actor);
      return { outcome: 'confirmed', booking: getById(bookingId) };
    };
    const flagRefund = (reason, { cancel }) => {
      db()
        .prepare(
          `UPDATE bookings SET paid_amount = paid_amount + ?, paid_at = ?, refund_status = 'pending', updated_at = ? WHERE id = ?`
        )
        .run(amount, now, now, bookingId);
      if (cancel) {
        db()
          .prepare(`UPDATE bookings SET status = 'cancelled', cancel_reason = ?, cancelled_at = ? WHERE id = ?`)
          .run(reason, now, bookingId);
      }
      logEvent(bookingId, 'refund_needed', reason, actor);
      return { outcome: 'refund', booking: getById(bookingId) };
    };

    if (booking.status === 'pending') return confirm(detail);
    if (booking.status === 'expired') {
      if (slots.slotIsFree(booking.date, booking.start_min, booking.end_min, { now, excludeId: bookingId })) {
        return confirm('Барих хугацаа дууссаны дараа төлөгдсөн, цаг сул байсан тул баталгаажуулав');
      }
      return flagRefund('Барих хугацаа дууссаны дараа төлөгдсөн, цаг өөр захиалгад орсон байна. Буцаалт хийнэ үү.', {
        cancel: true,
      });
    }
    if (booking.status === 'cancelled') {
      return flagRefund('Цуцлагдсан захиалгад төлбөр орсон. Буцаалт хийнэ үү.', { cancel: false });
    }
    // Already confirmed: a second payment means the customer paid twice.
    if (amount > 0) return flagRefund('Давхар төлбөр орсон. Илүү төлбөрийг буцаана уу.', { cancel: false });
    return { outcome: 'already', booking };
  });
}

// Records a provider payment against its invoice, idempotently.
function applyPayment(paymentId, result, now = Date.now()) {
  const marked = tx(() => {
    const payment = db().prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!payment || payment.status === 'paid') return null;
    db()
      .prepare(`UPDATE payments SET status = 'paid', provider_payment_id = ?, raw = ?, paid_at = ?, updated_at = ? WHERE id = ?`)
      .run(result.paymentId, JSON.stringify(result.raw).slice(0, 20000), now, now, paymentId);
    return payment;
  });
  if (!marked) return { outcome: 'already', booking: null };

  const res = applyConfirmation(marked.booking_id, {
    amount: result.paidAmount || marked.amount,
    detail: `QPay төлбөр ${result.paymentId || ''}`.trim(),
    now,
  });
  if (res.outcome === 'confirmed') {
    notify.bookingConfirmed(res.booking).catch((err) => console.error('[notify]', err));
  }
  return res;
}

const lastCheck = shared('paymentLastCheck', () => new Map());

// Asks QPay whether any open invoice of this booking is paid. Throttled per
// booking because both the payment page and the callback can trigger it.
// The QPay callback passes includeCancelled so a payment that raced the
// invoice cancellation is still recorded (and refunded or reinstated).
async function checkPayment(booking, { minIntervalMs = 3000, includeCancelled = false } = {}) {
  const last = lastCheck.get(booking.id) || 0;
  if (Date.now() - last < minIntervalMs) return getById(booking.id);
  lastCheck.set(booking.id, Date.now());

  for (const payment of openInvoices(booking.id, { includeCancelled })) {
    const result = await qpay.checkPayment(payment.invoice_id);
    if (result.paid && result.paidAmount >= payment.amount) {
      applyPayment(payment.id, result);
    } else if (result.paid) {
      logEvent(booking.id, 'partial_payment', `${result.paidAmount}/${payment.amount}`);
    }
  }
  return getById(booking.id);
}

// ── Background sweeps ─────────────────────────────────────

async function expireHolds(now = Date.now()) {
  const stale = db().prepare(`SELECT * FROM bookings WHERE status = 'pending' AND hold_expires_at <= ?`).all(now);
  for (const booking of stale) {
    try {
      await checkPayment(booking, { minIntervalMs: 0 });
    } catch (err) {
      console.error(`[qpay] final check for booking ${booking.id} failed: ${err.message}`);
    }
    const { changes } = db()
      .prepare(`UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending' AND hold_expires_at <= ?`)
      .run(Date.now(), booking.id, now);
    if (changes) {
      logEvent(booking.id, 'expired', 'Төлбөр төлөгдөөгүй тул цагийг суллав');
      await cancelOpenInvoices(booking.id);
    }
  }
  return stale.length;
}

// Fallback for missed QPay callbacks.
async function pollPendingPayments(now = Date.now()) {
  const pending = db()
    .prepare(
      `SELECT b.* FROM bookings b WHERE b.status = 'pending' AND b.hold_expires_at > ?
         AND EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'created')`
    )
    .all(now);
  for (const booking of pending) {
    try {
      await checkPayment(booking, { minIntervalMs: 20000 });
    } catch (err) {
      console.error(`[qpay] poll for booking ${booking.id} failed: ${err.message}`);
    }
  }
}

// Sends "tomorrow" reminders ~24h ahead to customers who booked more than a day in advance.
async function sendReminders(now = Date.now()) {
  if (!settings.get('sms').reminders) return 0;
  const tomorrow = addDays(nowLocal(now).date, 1);
  const candidates = db()
    .prepare(`SELECT * FROM bookings WHERE status = 'confirmed' AND date = ? AND reminder_sent_at IS NULL`)
    .all(tomorrow);
  let sent = 0;
  for (const booking of candidates) {
    // A day-only booking is reminded from the opening time of the day before.
    const startMin = booking.day_only ? (slots.hoursFor(booking.date) || { start: 9 * 60 }).start : booking.start_min;
    const startsAt = localToEpoch(booking.date, startMin);
    const remindAt = startsAt - DAY_MS;
    if (now < remindAt) continue;
    if ((booking.confirmed_at || booking.created_at) > remindAt) continue;
    const { changes } = db()
      .prepare('UPDATE bookings SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL')
      .run(now, booking.id);
    if (!changes) continue;
    await notify.reminder(booking);
    sent++;
  }
  return sent;
}

// ── Admin actions ─────────────────────────────────────────

function createManual({ serviceId, date, time, name, phone, note, paidAmount = 0, force = false, actor = 'admin', now = Date.now() }) {
  const customerName = cleanName(name);
  const customerPhone = normalizePhone(phone);
  if (!customerPhone) throw new BookingError('phone');
  if (!isValidDate(date)) throw new BookingError('date');
  const paid = Math.max(0, Math.round(Number(paidAmount) || 0));

  return tx(() => {
    const service = getService(serviceId, { activeOnly: false });
    if (!service) throw new BookingError('service');
    // The admin may book a special service on any day, closed days included.
    const dayOnly = slots.isSpecial(service);
    const start = dayOnly ? 0 : parseSlot(date, time);
    const end = dayOnly ? 0 : start + service.duration_min;
    if (end > 24 * 60) throw new BookingError('time');
    if (!dayOnly && !force && !slots.slotIsFree(date, start, end, { now })) throw new BookingError('slot_taken');
    const booking = insertBooking({
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      amount_due: 0,
      date,
      start_min: start,
      end_min: end,
      day_only: dayOnly ? 1 : 0,
      customer_name: customerName,
      phone: customerPhone,
      note: cleanNote(note),
      status: 'confirmed',
      source: 'admin',
      paid_amount: paid,
      paid_at: paid ? now : null,
      confirmed_at: now,
    });
    if (paid) insertManualPayment(booking.id, paid, 'Гараар нэмсэн захиалга', now);
    logEvent(booking.id, 'created', `Админ гараар нэмсэв${force ? ' (давхцлыг үл тоосон)' : ''}`, actor);
    return booking;
  });
}

function insertManualPayment(bookingId, amount, note, now = Date.now()) {
  db()
    .prepare(
      `INSERT INTO payments (booking_id, provider, amount, status, note, created_at, paid_at, updated_at)
       VALUES (?, 'manual', ?, 'paid', ?, ?, ?, ?)`
    )
    .run(bookingId, amount, note, now, now, now);
}

function recordManualPayment(id, { amount, note, actor = 'admin', now = Date.now() }) {
  const value = Math.round(Number(amount) || 0);
  if (value <= 0) throw new BookingError('amount');
  return tx(() => {
    const booking = getById(id);
    if (!booking) throw new BookingError('not_found');
    insertManualPayment(id, value, String(note || 'Бэлэн/шилжүүлэг').slice(0, 200), now);
    db()
      .prepare('UPDATE bookings SET paid_amount = paid_amount + ?, paid_at = ?, updated_at = ? WHERE id = ?')
      .run(value, now, now, id);
    logEvent(id, 'manual_payment', `${value}₮`, actor);
    return getById(id);
  });
}

async function cancel(id, { reason, refund = false, actor = 'admin', now = Date.now() } = {}) {
  const booking = tx(() => {
    const current = getById(id);
    if (!current) throw new BookingError('not_found');
    if (!['pending', 'confirmed'].includes(current.status)) throw new BookingError('not_active');
    const refundStatus = refund && current.paid_amount > 0 ? 'pending' : null;
    db()
      .prepare(
        `UPDATE bookings SET status = 'cancelled', cancel_reason = ?, cancelled_at = ?, refund_status = COALESCE(?, refund_status),
           hold_expires_at = NULL, updated_at = ? WHERE id = ?`
      )
      .run(String(reason || '').slice(0, 300) || null, now, refundStatus, now, id);
    logEvent(id, 'cancelled', [reason, refundStatus && 'буцаалт хийнэ'].filter(Boolean).join(' · ') || null, actor);
    return getById(id);
  });
  await cancelOpenInvoices(id);
  return booking;
}

function markRefunded(id, { actor = 'admin', now = Date.now() } = {}) {
  const { changes } = db()
    .prepare(`UPDATE bookings SET refund_status = 'done', updated_at = ? WHERE id = ? AND refund_status = 'pending'`)
    .run(now, id);
  if (!changes) throw new BookingError('not_found');
  logEvent(id, 'refunded', null, actor);
  return getById(id);
}

function reschedule(id, { date, time, force = false, actor = 'admin', now = Date.now() }) {
  if (!isValidDate(date)) throw new BookingError('date');
  return tx(() => {
    const booking = getById(id);
    if (!booking) throw new BookingError('not_found');
    if (!['confirmed', 'pending'].includes(effectiveStatus(booking, now))) throw new BookingError('not_active');
    // A day-only booking moves to another day; it has no time.
    const start = booking.day_only ? 0 : parseSlot(date, time);
    const end = start + (booking.end_min - booking.start_min);
    if (end > 24 * 60) throw new BookingError('time');
    if (!booking.day_only && !force && !slots.slotIsFree(date, start, end, { now, excludeId: id })) {
      throw new BookingError('slot_taken');
    }
    db()
      .prepare(`UPDATE bookings SET date = ?, start_min = ?, end_min = ?, reminder_sent_at = NULL, updated_at = ? WHERE id = ?`)
      .run(date, start, end, now, id);
    const moved = getById(id);
    logEvent(id, 'rescheduled', `${whenText(booking)} → ${whenText(moved)}`, actor);
    return moved;
  });
}

function setAdminNote(id, note, actor = 'admin') {
  db()
    .prepare('UPDATE bookings SET admin_note = ?, updated_at = ? WHERE id = ?')
    .run(String(note || '').trim().slice(0, 1000) || null, Date.now(), id);
  logEvent(id, 'note', null, actor);
}

export {  BookingError,
  getById,
  getByToken,
  getService,
  amountDue,
  whenText,
  effectiveStatus,
  logEvent,
  createHold,
  startPayment,
  applyPayment,
  applyConfirmation,
  checkPayment,
  expireHolds,
  pollPendingPayments,
  sendReminders,
  createManual,
  recordManualPayment,
  cancel,
  markRefunded,
  reschedule,
  setAdminNote,
};
