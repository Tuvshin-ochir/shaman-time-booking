'use server';

import { db } from '@/db.js';
import * as bookings from '@/lib/bookings.js';
import { requireAdmin, field, checked, done } from '@/lib/admin.js';

function intInRange(value, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function serviceForm(formData) {
  const get = (name) => field(formData.get(name));
  const form = {
    kind: get('kind') === 'special' ? 'special' : 'regular',
    name: get('name').slice(0, 100),
    description: get('description').slice(0, 1000),
    price: get('price').replace(/[\s,]/g, ''),
    deposit: get('deposit').replace(/[\s,]/g, ''),
    duration_min: get('duration_min'),
    sort: get('sort') || '0',
    active: checked(formData.get('active')) ? 1 : 0,
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
  // A special service is booked for a whole day, so it has no duration.
  const duration = form.kind === 'special' ? 0 : intInRange(form.duration_min, 5, 600);
  if (duration === null) errors.push('Үргэлжлэх хугацаа 5–600 минут байна.');
  const sort = intInRange(form.sort, -1000, 1000) ?? 0;
  return { errors, values: [form.kind, form.name, form.description || null, price, deposit, duration, form.active, sort] };
}

export async function createService(formData) {
  await requireAdmin();
  const { errors, values } = serviceForm(formData);
  if (errors.length) return { errors };
  db()
    .prepare(
      `INSERT INTO services (kind, name, description, price, deposit, duration_min, active, sort, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values, Date.now());
  done('/admin/services?ok=saved');
}

export async function updateService(id, formData) {
  await requireAdmin();
  if (!bookings.getService(id, { activeOnly: false })) done('/admin/services');
  const { errors, values } = serviceForm(formData);
  if (errors.length) return { errors };
  db()
    .prepare(
      `UPDATE services SET kind = ?, name = ?, description = ?, price = ?, deposit = ?, duration_min = ?, active = ?, sort = ?
         WHERE id = ?`
    )
    .run(...values, id);
  done('/admin/services?ok=saved');
}

// Services that were ever booked are only hidden (deleted_at) so old bookings keep their history.
export async function deleteService(id) {
  await requireAdmin();
  const service = bookings.getService(id, { activeOnly: false });
  if (service) {
    const booked = db().prepare('SELECT COUNT(*) AS n FROM bookings WHERE service_id = ?').get(service.id).n;
    if (booked) db().prepare('UPDATE services SET deleted_at = ?, active = 0 WHERE id = ?').run(Date.now(), service.id);
    else db().prepare('DELETE FROM services WHERE id = ?').run(service.id);
  }
  done('/admin/services?ok=service_deleted');
}
