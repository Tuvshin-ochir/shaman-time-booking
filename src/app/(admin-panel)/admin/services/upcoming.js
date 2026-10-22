import { db } from '@/db.js';
import * as slots from '@/lib/slots.js';
import { nowLocal } from '@/lib/time.js';

// Confirmed or held future bookings per service, shown before deleting.
export function upcomingCounts() {
  const rows = db()
    .prepare(`SELECT service_id, COUNT(*) AS n FROM bookings WHERE date >= ? AND ${slots.BLOCKING_SQL} GROUP BY service_id`)
    .all(nowLocal().date, Date.now());
  return Object.fromEntries(rows.map((r) => [r.service_id, r.n]));
}
