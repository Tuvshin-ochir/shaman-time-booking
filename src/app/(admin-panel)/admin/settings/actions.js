'use server';

import * as settings from '@/lib/settings.js';
import * as auth from '@/lib/auth.js';
import * as sms from '@/lib/sms.js';
import { normalizePhone, parsePhoneList } from '@/lib/phone.js';
import { requireAdmin, field, checked, done, setSessionCookie } from '@/lib/admin.js';

export async function saveBusiness(formData) {
  await requireAdmin();
  const keys = Object.keys(settings.DEFAULTS.business);
  const value = Object.fromEntries(keys.map((k) => [k, field(formData.get(k)).slice(0, 300)]));
  const errors = [];
  if (!value.name) errors.push('Байгууллагын нэр оруулна уу.');
  for (const key of ['map_url', 'facebook_url']) {
    if (value[key] && !/^https?:\/\//i.test(value[key])) errors.push(`${key}: http(s):// -ээр эхэлсэн холбоос оруулна уу.`);
  }
  if (errors.length) return { errors };
  settings.set('business', value);
  done('/admin/settings?ok=saved');
}

export async function saveContent(formData) {
  await requireAdmin();
  const content = { ...settings.get('content') };
  for (const key of Object.keys(settings.DEFAULTS.content)) {
    if (formData.has(key)) content[key] = String(formData.get(key) ?? '').trim().slice(0, 10000);
  }
  settings.set('content', content);
  done('/admin/settings?ok=saved#content');
}

export async function saveSms(formData) {
  await requireAdmin();
  const { valid, invalid } = parsePhoneList(formData.get('staff_phones'));
  if (invalid.length) return { errors: [`Буруу дугаар: ${invalid.join(', ')}`] };
  const templates = {};
  for (const key of Object.keys(settings.DEFAULTS.sms.templates)) {
    templates[key] = field(formData.get(`tpl_${key}`)).slice(0, 500) || settings.DEFAULTS.sms.templates[key];
  }
  settings.set('sms', {
    staff_phones: valid.join(', '),
    reminders: checked(formData.get('reminders')),
    transliterate: checked(formData.get('transliterate')),
    templates,
  });
  done('/admin/settings?ok=saved#sms');
}

export async function sendTestSms(formData) {
  await requireAdmin();
  const phone = normalizePhone(field(formData.get('phone')));
  if (!phone) done('/admin/settings?err=phone#sms');
  await sms.send(phone, `${settings.get('business').name}: Туршилтын SMS. Тохиргоо зөв байна.`, { kind: 'test' });
  done('/admin/sms?ok=sms');
}

export async function changePassword(formData) {
  const admin = await requireAdmin();
  const next = String(formData.get('new_password') || '');
  const errors = [];
  if (!auth.verifyPassword(String(formData.get('current') || ''), admin.password_hash)) errors.push('Одоогийн нууц үг буруу.');
  if (next.length < 10) errors.push('Шинэ нууц үг хамгийн багадаа 10 тэмдэгт байна.');
  if (next !== String(formData.get('confirm') || '')) errors.push('Шинэ нууц үг таарахгүй байна.');
  if (errors.length) return { errors };
  auth.setPassword(admin.username, next);
  await setSessionCookie(auth.findAdmin(admin.username));
  done('/admin/settings?ok=password');
}
