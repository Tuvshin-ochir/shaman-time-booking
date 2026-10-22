// Booking list filters, shared by /admin/bookings and its CSV export.
import * as slots from './slots.js';
import { nowLocal, isValidDate } from './time.js';

const field = (value) => String(Array.isArray(value) ? value[0] : (value ?? '')).trim();

export const PAGE_SIZE = 50;

export function bookingQuery(query, now = Date.now()) {
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
