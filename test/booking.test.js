require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../src/db');
const settings = require('../src/lib/settings');
const slots = require('../src/lib/slots');
const bookings = require('../src/lib/bookings');
const qpay = require('../src/lib/qpay');
const { normalizePhone } = require('../src/lib/phone');
const { transliterate } = require('../src/lib/sms');
const { localToEpoch, fromMin, nowLocal } = require('../src/lib/time');

// 2030-01-06 is a Sunday; 2030-01-07 a Monday.
const SUNDAY = '2030-01-06';
const MONDAY = '2030-01-07';
const NOW = localToEpoch(SUNDAY, 8 * 60);
const MIN = 60000;

function resetSchedule(overrides = {}) {
  const closed = { open: false, start: '09:00', end: '12:00', break_start: '', break_end: '' };
  const weekly = Array.from({ length: 7 }, () => ({ ...closed }));
  weekly[1] = { open: true, start: '09:00', end: '12:00', break_start: '10:00', break_end: '10:30' };
  settings.set('schedule', {
    weekly,
    slot_minutes: 30,
    lead_minutes: 60,
    window_days: 30,
    hold_minutes: 15,
    capacity: 1,
    ...overrides,
  });
  db().exec('DELETE FROM booking_events; DELETE FROM sms_log; DELETE FROM payments; DELETE FROM bookings; DELETE FROM holidays;');
}

function service(duration = 30, extra = {}) {
  const info = db()
    .prepare(
      `INSERT INTO services (name, price, deposit, duration_min, active, sort, created_at) VALUES (?, ?, ?, ?, 1, 99, ?)`
    )
    .run(`Test ${duration}`, extra.price ?? 30000, extra.deposit ?? null, duration, Date.now());
  return bookings.getService(Number(info.lastInsertRowid));
}

function hold(svc, time, phone, now = NOW) {
  return bookings.createHold({ serviceId: svc.id, date: MONDAY, time, name: 'Бат', phone, now });
}

test('phone numbers are normalised and validated', () => {
  assert.equal(normalizePhone('9911-2233'), '99112233');
  assert.equal(normalizePhone('+976 8811 2233'), '88112233');
  assert.equal(normalizePhone('97699112233'), '99112233');
  assert.equal(normalizePhone('70112233'), null); // landline
  assert.equal(normalizePhone('9911223'), null);
  assert.equal(normalizePhone('abc'), null);
});

test('Mongolian Cyrillic is transliterated for SMS', () => {
  assert.equal(transliterate('Захиалга баталгаажлаа. Үзлэг өнөөдөр'), 'Zahialga batalgaajlaa. Uzleg unuudur');
});

test('fitsCapacity counts the real peak overlap', () => {
  const b = (s, e) => ({ start_min: s, end_min: e });
  assert.equal(slots.fitsCapacity([b(540, 570)], 540, 570, 1), false);
  assert.equal(slots.fitsCapacity([b(540, 570)], 570, 600, 1), true); // touching is fine
  // Two bookings that do not overlap each other leave room for a second one at capacity 2.
  assert.equal(slots.fitsCapacity([b(540, 570), b(570, 600)], 540, 600, 2), true);
  assert.equal(slots.fitsCapacity([b(540, 600), b(570, 600)], 570, 600, 2), false);
});

test('available times respect hours, break, lead time and holidays', () => {
  resetSchedule();
  const s30 = service(30);
  const s60 = service(60);
  assert.deepEqual(slots.availableTimes(s30, MONDAY, { now: NOW }).map(fromMin), ['09:00', '09:30', '10:30', '11:00', '11:30']);
  assert.deepEqual(slots.availableTimes(s60, MONDAY, { now: NOW }).map(fromMin), ['09:00', '10:30', '11:00']);
  assert.deepEqual(slots.availableTimes(s30, SUNDAY, { now: NOW }), []);

  // Lead time: at 09:10 on Monday the earliest bookable start is 10:10.
  const mondayMorning = localToEpoch(MONDAY, 9 * 60 + 10);
  assert.deepEqual(slots.availableTimes(s30, MONDAY, { now: mondayMorning }).map(fromMin), ['10:30', '11:00', '11:30']);

  db().prepare('INSERT INTO holidays (date, note) VALUES (?, ?)').run(MONDAY, 'test');
  assert.deepEqual(slots.availableTimes(s30, MONDAY, { now: NOW }), []);
});

test('a held slot cannot be booked twice, and is released after the hold expires', () => {
  resetSchedule();
  const s = service(30);
  const first = hold(s, '09:00', '99110001');
  assert.equal(first.status, 'pending');
  assert.equal(first.hold_expires_at, NOW + 15 * MIN);

  assert.throws(() => hold(s, '09:00', '99110002'), { code: 'slot_taken' });
  assert.ok(!slots.availableTimes(s, MONDAY, { now: NOW }).includes(540));

  const later = NOW + 16 * MIN;
  assert.ok(slots.availableTimes(s, MONDAY, { now: later }).includes(540));
  const second = hold(s, '09:00', '99110002', later);
  assert.equal(second.status, 'pending');
});

test('a new hold from the same phone releases the previous one', () => {
  resetSchedule();
  const s = service(30);
  const first = hold(s, '09:00', '99110003');
  hold(s, '09:30', '99110003');
  assert.equal(bookings.getById(first.id).status, 'expired');
  assert.ok(slots.availableTimes(s, MONDAY, { now: NOW }).includes(540));
});

test('rejects bad input', () => {
  resetSchedule();
  const s = service(30);
  assert.throws(() => hold(s, '09:00', '123'), { code: 'phone' });
  assert.throws(() => hold(s, '09:15', '99110004'), { code: 'slot_taken' }); // not on the slot grid
  assert.throws(
    () => bookings.createHold({ serviceId: s.id, date: MONDAY, time: '09:00', name: 'A', phone: '99110004', now: NOW }),
    { code: 'name' }
  );
  assert.throws(
    () => bookings.createHold({ serviceId: 9999, date: MONDAY, time: '09:00', name: 'Бат', phone: '99110004', now: NOW }),
    { code: 'service' }
  );
});

test('payment confirms the booking and sends SMS to customer and staff', async () => {
  resetSchedule();
  settings.set('sms', { ...settings.get('sms'), staff_phones: '88001122' });
  const s = service(30, { price: 50000, deposit: 20000 });
  const booking = hold(s, '09:00', '99110005');
  assert.equal(booking.amount_due, 20000);

  const { payment } = await bookings.startPayment(booking);
  assert.equal(payment.amount, 20000);
  assert.equal(payment.status, 'created');

  // Not paid yet
  assert.equal((await bookings.checkPayment(booking, { minIntervalMs: 0 })).status, 'pending');

  assert.ok(qpay.mockPay(payment.invoice_id));
  const confirmed = await bookings.checkPayment(booking, { minIntervalMs: 0 });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.paid_amount, 20000);

  // Checking again is idempotent
  const again = await bookings.checkPayment(booking, { minIntervalMs: 0 });
  assert.equal(again.paid_amount, 20000);

  await new Promise((r) => setTimeout(r, 20)); // SMS are sent asynchronously
  const sent = db().prepare('SELECT kind, to_phone FROM sms_log WHERE booking_id = ? ORDER BY id').all(booking.id);
  assert.deepEqual(
    sent.map((r) => [r.kind, r.to_phone]).sort(),
    [['customer_confirm', '99110005'], ['staff_new', '88001122']]
  );
  settings.set('sms', { ...settings.get('sms'), staff_phones: '' });
});

test('unpaid holds expire and their invoice is cancelled', async () => {
  resetSchedule();
  const s = service(30);
  const booking = hold(s, '09:00', '99110006');
  const { payment } = await bookings.startPayment(booking);
  await bookings.expireHolds(NOW + 16 * MIN);
  assert.equal(bookings.getById(booking.id).status, 'expired');
  assert.equal(db().prepare('SELECT status FROM payments WHERE id = ?').get(payment.id).status, 'cancelled');
  assert.equal(qpay.mockPay(payment.invoice_id), false);
});

test('late payment: reinstated if the slot is still free, refund flagged if taken', async () => {
  resetSchedule();
  const s = service(30);
  const paid = (p) => ({ paid: true, paidAmount: p.amount, paymentId: `P-${p.id}`, raw: {} });

  // Slot still free -> confirmed
  const a = hold(s, '09:00', '99110007');
  const { payment: pa } = await bookings.startPayment(a);
  db().prepare(`UPDATE bookings SET status = 'expired' WHERE id = ?`).run(a.id);
  assert.equal(bookings.applyPayment(pa.id, paid(pa)).outcome, 'confirmed');
  assert.equal(bookings.getById(a.id).status, 'confirmed');

  // Slot taken by someone else -> cancelled + refund pending
  const b = hold(s, '09:30', '99110008');
  const { payment: pb } = await bookings.startPayment(b);
  db().prepare(`UPDATE bookings SET status = 'expired' WHERE id = ?`).run(b.id);
  hold(s, '09:30', '99110009');
  const res = bookings.applyPayment(pb.id, paid(pb));
  assert.equal(res.outcome, 'refund');
  const after = bookings.getById(b.id);
  assert.equal(after.status, 'cancelled');
  assert.equal(after.refund_status, 'pending');
  assert.equal(after.paid_amount, pb.amount);
});

test('capacity > 1 allows parallel bookings up to the limit', () => {
  resetSchedule({ capacity: 2 });
  const s = service(30);
  hold(s, '09:00', '99110010');
  hold(s, '09:00', '99110011');
  assert.throws(() => hold(s, '09:00', '99110012'), { code: 'slot_taken' });
});

test('admin actions: manual booking, reschedule conflict, cancel with refund', async () => {
  resetSchedule();
  const s = service(30);
  const manual = bookings.createManual({ serviceId: s.id, date: MONDAY, time: '09:00', name: 'Дорж', phone: '99110013', paidAmount: 30000, now: NOW });
  assert.equal(manual.status, 'confirmed');
  assert.equal(manual.paid_amount, 30000);
  assert.throws(
    () => bookings.createManual({ serviceId: s.id, date: MONDAY, time: '09:00', name: 'Сүх', phone: '99110014', now: NOW }),
    { code: 'slot_taken' }
  );
  const other = bookings.createManual({ serviceId: s.id, date: MONDAY, time: '11:00', name: 'Сүх', phone: '99110014', now: NOW });

  assert.throws(() => bookings.reschedule(other.id, { date: MONDAY, time: '09:00', now: NOW }), { code: 'slot_taken' });
  const moved = bookings.reschedule(other.id, { date: MONDAY, time: '11:30', now: NOW });
  assert.equal(fromMin(moved.start_min), '11:30');
  assert.equal(fromMin(moved.end_min), '12:00');

  const cancelled = await bookings.cancel(manual.id, { reason: 'test', refund: true });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.refund_status, 'pending');
  assert.equal(bookings.markRefunded(manual.id).refund_status, 'done');
  // Cancelling frees the slot
  assert.ok(slots.availableTimes(s, MONDAY, { now: NOW }).includes(540));
});

test('reminders go out once, the day before, only for bookings made in advance', async () => {
  resetSchedule();
  const s = service(30);
  const booking = bookings.createManual({ serviceId: s.id, date: MONDAY, time: '10:30', name: 'Бат', phone: '99110015', now: NOW - 3 * 86400000 });
  db().prepare('UPDATE bookings SET confirmed_at = ? WHERE id = ?').run(NOW - 3 * 86400000, booking.id);

  const dayBefore = localToEpoch(SUNDAY, 10 * 60 + 35); // 5 min after the 24h-before mark
  assert.equal(await bookings.sendReminders(localToEpoch(SUNDAY, 9 * 60)), 0); // too early
  assert.equal(await bookings.sendReminders(dayBefore), 1);
  assert.equal(await bookings.sendReminders(dayBefore + 5 * MIN), 0); // only once
  assert.equal(nowLocal(dayBefore).date, SUNDAY);
});
