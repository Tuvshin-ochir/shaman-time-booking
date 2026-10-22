import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.js';
import * as settings from '../src/lib/settings.js';
import * as slots from '../src/lib/slots.js';
import * as bookings from '../src/lib/bookings.js';
import * as qpay from '../src/lib/qpay.js';
import * as notify from '../src/lib/notify.js';
import { formatWhen } from '../src/i18n/index.js';
import { normalizePhone } from '../src/lib/phone.js';
import { transliterate } from '../src/lib/sms.js';
import { localToEpoch, fromMin, nowLocal } from '../src/lib/time.js';

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
  db().exec('DELETE FROM booking_events; DELETE FROM sms_log; DELETE FROM payments; DELETE FROM bookings; DELETE FROM holidays; DELETE FROM time_blocks;');
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

test('hours closed on one date are not bookable; the rest of the day and other days stay open', () => {
  resetSchedule();
  const s30 = service(30);
  const s60 = service(60);
  db()
    .prepare('INSERT INTO time_blocks (date, start_min, end_min, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(MONDAY, 11 * 60, 11 * 60 + 30, 'Гадуур', NOW);
  assert.deepEqual(slots.availableTimes(s30, MONDAY, { now: NOW }).map(fromMin), ['09:00', '09:30', '10:30', '11:30']);
  // A 60-minute service starting at 10:30 would run into the closed half hour.
  assert.deepEqual(slots.availableTimes(s60, MONDAY, { now: NOW }).map(fromMin), ['09:00']);
  assert.deepEqual(slots.availableTimes(s30, '2030-01-14', { now: NOW }).map(fromMin), ['09:00', '09:30', '10:30', '11:00', '11:30']);
  assert.throws(() => hold(s30, '11:00', '99110003'), { code: 'slot_taken' });

  // Closing every open hour leaves the day without free times.
  db()
    .prepare('INSERT INTO time_blocks (date, start_min, end_min, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(MONDAY, 9 * 60, 12 * 60, null, NOW);
  const monday = slots.availableDays(s30, { now: NOW }).find((d) => d.date === MONDAY);
  assert.deepEqual([monday.closed, monday.free], [false, 0]);
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

test('special services: only a day is chosen, any open day, and no time slot is taken', async () => {
  resetSchedule();
  const regular = service(30);
  const info = db()
    .prepare(`INSERT INTO services (kind, name, price, deposit, duration_min, active, sort, created_at) VALUES ('special', ?, ?, NULL, 0, 1, 99, ?)`)
    .run('Тусгай засал', 50000, Date.now());
  const special = bookings.getService(Number(info.lastInsertRowid));
  assert.ok(slots.isSpecial(special));
  assert.deepEqual(slots.availableTimes(special, MONDAY, { now: NOW }), []);

  // Every open day of the window is bookable; Sunday (day off) and holidays are not.
  const holiday = '2030-01-14';
  db().prepare('INSERT INTO holidays (date, note) VALUES (?, ?)').run(holiday, 'Баяр');
  const days = slots.availableDays(special, { now: NOW });
  assert.deepEqual(
    days.filter((d) => d.free).map((d) => d.date),
    ['2030-01-07', '2030-01-21', '2030-01-28', '2030-02-04']
  );
  assert.equal(days.find((d) => d.date === SUNDAY).closed, true);
  assert.throws(() => bookings.createHold({ serviceId: special.id, date: SUNDAY, name: 'Бат', phone: '99110020', now: NOW }), { code: 'day_closed' });
  assert.throws(() => bookings.createHold({ serviceId: special.id, date: holiday, name: 'Бат', phone: '99110020', now: NOW }), { code: 'day_closed' });
  // Today stops being bookable once closing time (minus the lead time) has passed.
  assert.equal(slots.dayIsBookable(MONDAY, { now: localToEpoch(MONDAY, 10 * 60) }), true);
  assert.equal(slots.dayIsBookable(MONDAY, { now: localToEpoch(MONDAY, 11 * 60 + 30) }), false);

  // No time is needed (a sent one is ignored); several customers can take the same day.
  const a = bookings.createHold({ serviceId: special.id, date: MONDAY, name: 'Бат', phone: '99110020', now: NOW });
  const b = bookings.createHold({ serviceId: special.id, date: MONDAY, time: '09:00', name: 'Дорж', phone: '99110021', now: NOW });
  for (const x of [a, b]) {
    assert.equal(x.day_only, 1);
    assert.equal(x.start_min, 0);
    assert.equal(x.end_min, 0);
    assert.equal(x.amount_due, 50000);
  }
  // Regular times of that day stay free.
  assert.deepEqual(slots.availableTimes(regular, MONDAY, { now: NOW }).map(fromMin), ['09:00', '09:30', '10:30', '11:00', '11:30']);
  const timed = hold(regular, '09:00', '99110022');

  // Texts: no time anywhere, and the SMS drops {time} together with its case ending.
  assert.equal(formatWhen(a), '1-р сарын 7, Даваа');
  assert.equal(formatWhen(timed), '1-р сарын 7, Даваа, 09:00');
  assert.equal(bookings.whenText(a), MONDAY);
  const template = 'Маргааш {date} {time}-д таны цаг. Цаг: {date} {time}.';
  assert.equal(notify.render(template, notify.vars(a)), 'Маргааш 2030.01.07 таны цаг. Цаг: 2030.01.07.');
  assert.equal(notify.render(template, notify.vars(timed)), 'Маргааш 2030.01.07 09:00-д таны цаг. Цаг: 2030.01.07 09:00.');

  // The admin can book any day (closed ones too) and move it to another day.
  const manual = bookings.createManual({ serviceId: special.id, date: SUNDAY, name: 'Сүх', phone: '99110023', now: NOW });
  assert.equal(manual.day_only, 1);
  assert.equal(manual.status, 'confirmed');
  const moved = bookings.reschedule(manual.id, { date: '2030-01-21', time: '', now: NOW });
  assert.equal(moved.date, '2030-01-21');
  assert.equal(moved.start_min, 0);
  assert.equal(moved.end_min, 0);

  // The reminder goes out the day before at opening time (09:00).
  const early = bookings.createManual({ serviceId: special.id, date: MONDAY, name: 'Төмөр', phone: '99110024', now: NOW - 3 * 86400000 });
  db().prepare('UPDATE bookings SET confirmed_at = ? WHERE id = ?').run(NOW - 3 * 86400000, early.id);
  assert.equal(await bookings.sendReminders(localToEpoch(SUNDAY, 8 * 60 + 55)), 0);
  assert.equal(await bookings.sendReminders(localToEpoch(SUNDAY, 9 * 60 + 5)), 1);
});

test('in person or online: stored on the booking, required to be valid, and named in the SMS', () => {
  resetSchedule();
  const s = service(30);
  const inPerson = hold(s, '09:00', '99110030');
  assert.equal(inPerson.meeting, 'in_person'); // the default for callers that do not ask
  const online = bookings.createHold({ serviceId: s.id, date: MONDAY, time: '09:30', name: 'Бат', phone: '99110031', meeting: 'online', now: NOW });
  assert.equal(online.meeting, 'online');
  assert.throws(
    () => bookings.createHold({ serviceId: s.id, date: MONDAY, time: '10:30', name: 'Бат', phone: '99110032', meeting: 'video', now: NOW }),
    { code: 'meeting' }
  );
  assert.equal(bookings.createManual({ serviceId: s.id, date: MONDAY, time: '11:00', name: 'Сүх', phone: '99110033', meeting: 'online', now: NOW }).meeting, 'online');

  const confirm = settings.DEFAULTS.sms.templates.customer_confirm;
  assert.match(notify.render(confirm, notify.vars(online)), /Цаг: 2030\.01\.07 09:30, онлайнаар\..*Хаяг: онлайн\./);
  assert.match(notify.render(confirm, notify.vars(inPerson)), /Цаг: 2030\.01\.07 09:00, биеэр\./);
});

test('SMS texts saved unedited from an older default follow the new default; edited ones stay', () => {
  const saved = settings.get('sms');
  const old = '{business}: Захиалга баталгаажлаа. Цаг: {date} {time}. Нэр: {name}, утас: {phone}. Хаяг: {address}. Лавлах: {contact}';
  settings.set('sms', { ...saved, templates: { ...saved.templates, customer_confirm: old, staff_new: 'Миний текст {date}' } });
  assert.equal(settings.get('sms').templates.customer_confirm, settings.DEFAULTS.sms.templates.customer_confirm);
  assert.match(settings.get('sms').templates.customer_confirm, /\{mode\}/);
  assert.equal(settings.get('sms').templates.staff_new, 'Миний текст {date}');
  settings.set('sms', saved);
});
