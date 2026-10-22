import { db } from '@/db.js';
import * as bookings from '@/lib/bookings.js';
import { bookingQuery } from '@/lib/admin-bookings.js';
import { STATUS_LABELS } from '@/lib/admin-messages.js';
import { currentAdmin } from '@/lib/admin.js';
import { nowLocal, fromMin } from '@/lib/time.js';

function csvCell(value) {
  const s = String(value ?? '');
  // Leading = + - @ would be treated as formulas by Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request) {
  if (!(await currentAdmin())) return new Response(null, { status: 303, headers: { Location: '/admin/login' } });
  const { sql, order, params } = bookingQuery(Object.fromEntries(request.nextUrl.searchParams));
  const rows = db().prepare(`SELECT * ${sql} ORDER BY ${order}`).all(...params);
  const header = ['Код', 'Огноо', 'Цаг', 'Үйлчилгээ', 'Нэр', 'Утас', 'Төлөв', 'Үнэ', 'Төлсөн', 'Буцаалт', 'Эх сурвалж', 'Тайлбар'];
  const lines = rows.map((b) =>
    [
      b.code,
      b.date,
      b.day_only ? '' : fromMin(b.start_min),
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
  return new Response(`﻿${[header.join(','), ...lines].join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${nowLocal().date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
