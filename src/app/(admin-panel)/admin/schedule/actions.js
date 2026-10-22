'use server';

import { db } from '@/db.js';
import * as settings from '@/lib/settings.js';
import * as i18n from '@/i18n/index.js';
import { addDays, isValidDate, toMin, nowLocal } from '@/lib/time.js';
import { requireAdmin, field, checked, done } from '@/lib/admin.js';

function intInRange(value, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function saveSchedule(formData) {
  await requireAdmin();
  const get = (name) => formData.get(name);
  const names = i18n.DAY_NAMES;
  const errors = [];
  const weekly = [];
  for (let wd = 0; wd < 7; wd++) {
    const day = {
      open: checked(get(`open_${wd}`)),
      start: field(get(`start_${wd}`)),
      end: field(get(`end_${wd}`)),
      break_start: field(get(`break_start_${wd}`)),
      break_end: field(get(`break_end_${wd}`)),
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
    slot_minutes: [intInRange(get('slot_minutes'), 5, 240), 'Цагийн алхам 5–240 минут байна.'],
    lead_minutes: [intInRange(get('lead_minutes'), 0, 7 * 24 * 60), 'Хамгийн бага урьдчилах хугацаа буруу.'],
    window_days: [intInRange(get('window_days'), 1, 365), 'Захиалга авах хоног 1–365 байна.'],
    hold_minutes: [intInRange(get('hold_minutes'), 5, 60), 'Цаг барих хугацаа 5–60 минут байна.'],
    capacity: [intInRange(get('capacity'), 1, 50), 'Зэрэг үйлчлэх тоо 1–50 байна.'],
  };
  const schedule = { weekly };
  for (const [key, [value, message]] of Object.entries(numbers)) {
    if (value === null) errors.push(message);
    schedule[key] = value;
  }
  if (errors.length) return { errors };
  settings.set('schedule', schedule);
  done('/admin/schedule?ok=saved');
}

export async function addHoliday(formData) {
  await requireAdmin();
  const from = field(formData.get('date_from'));
  const to = field(formData.get('date_to')) || from;
  if (!isValidDate(from) || !isValidDate(to) || to < from || addDays(from, 92) < to) done('/admin/schedule?err=date');
  const note = field(formData.get('note')).slice(0, 100) || null;
  const insert = db().prepare('INSERT INTO holidays (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note');
  for (let d = from; d <= to; d = addDays(d, 1)) insert.run(d, note);
  done('/admin/schedule?ok=holiday');
}

export async function deleteHoliday(date) {
  await requireAdmin();
  db().prepare('DELETE FROM holidays WHERE date = ?').run(field(date));
  done('/admin/schedule?ok=holiday_deleted');
}

export async function addTimeBlock(formData) {
  await requireAdmin();
  const date = field(formData.get('date'));
  const start = toMin(field(formData.get('start')));
  const end = toMin(field(formData.get('end')));
  if (!isValidDate(date) || date < nowLocal().date) return { error: 'Өнөөдөр эсвэл түүнээс хойших өдөр сонгоно уу.' };
  if (!(start < end)) return { error: 'Эхлэх цаг дуусах цагаас өмнө байх ёстой.' };
  const note = field(formData.get('note')).slice(0, 100) || null;
  db()
    .prepare('INSERT INTO time_blocks (date, start_min, end_min, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(date, start, end, note, Date.now());
  done('/admin/schedule?ok=block');
}

export async function deleteTimeBlock(id) {
  await requireAdmin();
  db().prepare('DELETE FROM time_blocks WHERE id = ?').run(Number(id));
  done('/admin/schedule?ok=block_deleted');
}
