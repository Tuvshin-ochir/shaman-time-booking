'use server';

import { db } from '@/db.js';
import * as sms from '@/lib/sms.js';
import { requireAdmin, done } from '@/lib/admin.js';

export async function resend(id) {
  await requireAdmin();
  const row = db().prepare('SELECT * FROM sms_log WHERE id = ?').get(Number(id));
  if (row) await sms.send(row.to_phone, row.body, { bookingId: row.booking_id, kind: row.kind });
  done('/admin/sms?ok=sms');
}
