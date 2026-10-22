import { db } from '../db.js';
import * as settings from './settings.js';
import { nowLocal, addDays, weekday, toMin, localToEpoch } from './time.js';

// A booking blocks its time if it is confirmed, or pending with an unexpired hold.
const BLOCKING_SQL = `(status = 'confirmed' OR (status = 'pending' AND hold_expires_at > ?))`;

function blockingBookings(fromDate, toDate, { now = Date.now(), excludeId = 0 } = {}) {
  return db()
    .prepare(
      `SELECT id, date, start_min, end_min FROM bookings
       WHERE date BETWEEN ? AND ? AND id != ? AND ${BLOCKING_SQL}`
    )
    .all(fromDate, toDate, excludeId, now);
}

// Hours the admin closed on single dates, as [start_min, end_min) ranges.
function timeBlocks(fromDate, toDate) {
  return db().prepare('SELECT date, start_min, end_min FROM time_blocks WHERE date BETWEEN ? AND ?').all(fromDate, toDate);
}

function isHoliday(date) {
  return !!db().prepare('SELECT 1 FROM holidays WHERE date = ?').get(date);
}

// Opening hours for a date, or null when closed.
function hoursFor(date, schedule = settings.get('schedule')) {
  if (isHoliday(date)) return null;
  const day = schedule.weekly[weekday(date)];
  if (!day || !day.open) return null;
  const start = toMin(day.start);
  const end = toMin(day.end);
  if (!(start < end)) return null;
  const breakStart = toMin(day.break_start);
  const breakEnd = toMin(day.break_end);
  const hasBreak = breakStart < breakEnd;
  return { start, end, breakStart: hasBreak ? breakStart : null, breakEnd: hasBreak ? breakEnd : null };
}

// True if adding [start, end) keeps every moment below `capacity` overlapping bookings.
function fitsCapacity(bookings, start, end, capacity) {
  const overlapping = bookings.filter((b) => b.start_min < end && b.end_min > start);
  if (overlapping.length < capacity) return true;
  // Peak overlap inside [start, end) can only change at `start` or where another booking begins.
  const points = [start, ...overlapping.map((b) => b.start_min).filter((s) => s > start && s < end)];
  return points.every((p) => overlapping.filter((b) => b.start_min <= p && b.end_min > p).length < capacity);
}

function bookableRange(now = Date.now(), schedule = settings.get('schedule')) {
  const today = nowLocal(now).date;
  return { first: today, last: addDays(today, Math.max(1, schedule.window_days) - 1) };
}

// "Тусгай" (special) services are booked for a whole day, without a time.
const isSpecial = (service) => service.kind === 'special';

// Whether a customer can book a special service on `date`: any open day of the
// booking window (not a holiday or weekly day off); today only until closing time.
function dayIsBookable(date, { now = Date.now(), schedule = settings.get('schedule') } = {}) {
  const range = bookableRange(now, schedule);
  if (date < range.first || date > range.last) return false;
  const hours = hoursFor(date, schedule);
  return !!hours && localToEpoch(date, hours.end) > now + schedule.lead_minutes * 60000;
}

// Start times (minutes) a customer can book for `service` on `date`.
// `admin: true` drops the booking-window and lead-time limits.
function availableTimes(service, date, { now = Date.now(), excludeId = 0, bookings, blocks, admin = false } = {}) {
  if (isSpecial(service)) return [];
  const schedule = settings.get('schedule');
  const range = bookableRange(now, schedule);
  if (!admin && (date < range.first || date > range.last)) return [];
  const hours = hoursFor(date, schedule);
  if (!hours) return [];

  const dayBookings = (bookings || blockingBookings(date, date, { now, excludeId })).filter((b) => b.date === date);
  const dayBlocks = (blocks || timeBlocks(date, date)).filter((b) => b.date === date);
  const earliest = admin ? 0 : now + schedule.lead_minutes * 60000;
  const step = Math.max(5, schedule.slot_minutes);
  const duration = service.duration_min;
  const times = [];
  for (let t = hours.start; t + duration <= hours.end; t += step) {
    if (hours.breakStart !== null && t < hours.breakEnd && t + duration > hours.breakStart) continue;
    if (dayBlocks.some((b) => t < b.end_min && t + duration > b.start_min)) continue;
    if (localToEpoch(date, t) < earliest) continue;
    if (!fitsCapacity(dayBookings, t, t + duration, schedule.capacity)) continue;
    times.push(t);
  }
  return times;
}

// Every day in the booking window with whether it is closed / has free times.
function availableDays(service, { now = Date.now() } = {}) {
  const schedule = settings.get('schedule');
  const range = bookableRange(now, schedule);
  const bookings = blockingBookings(range.first, range.last, { now });
  const blocks = timeBlocks(range.first, range.last);
  const days = [];
  for (let date = range.first; date <= range.last; date = addDays(date, 1)) {
    const closed = !hoursFor(date, schedule);
    let free;
    if (closed) free = 0;
    else if (isSpecial(service)) free = dayIsBookable(date, { now, schedule }) ? 1 : 0;
    else free = availableTimes(service, date, { now, bookings, blocks }).length;
    days.push({ date, closed, free });
  }
  return days;
}

// Used by admin actions (manual booking / reschedule) where the time may be
// outside normal hours: only the overlap rule is enforced.
function slotIsFree(date, start, end, { now = Date.now(), excludeId = 0 } = {}) {
  const schedule = settings.get('schedule');
  return fitsCapacity(blockingBookings(date, date, { now, excludeId }), start, end, schedule.capacity);
}

export {  BLOCKING_SQL,
  blockingBookings,
  timeBlocks,
  hoursFor,
  fitsCapacity,
  bookableRange,
  isSpecial,
  dayIsBookable,
  availableTimes,
  availableDays,
  slotIsFree,
};
