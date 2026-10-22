'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db.js';
import * as auth from '@/lib/auth.js';
import { limiter, clientIp } from '@/lib/http.js';
import { field, setSessionCookie } from '@/lib/admin.js';
import { shared } from '@/lib/shared.js';

const loginLimit = limiter('login', { windowMs: 15 * 60 * 1000, max: 10 });
// Unknown usernames take as long as wrong passwords.
const dummyHash = () => shared('dummyHash', () => auth.hashPassword('timing-equaliser'));

function safeNext(value) {
  const next = field(value);
  return next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';
}

export async function login(formData) {
  if (!loginLimit(clientIp(await headers())).ok) {
    return { error: 'Хэт олон оролдлого хийлээ. 15 минутын дараа дахин оролдоно уу.' };
  }
  const username = field(formData.get('username'));
  const password = String(formData.get('password') || '');
  const admin = auth.findAdmin(username);
  const ok = auth.verifyPassword(password, admin ? admin.password_hash : dummyHash()) && !!admin;
  if (!ok) return { error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' };
  db().prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(Date.now(), admin.id);
  await setSessionCookie(admin);
  redirect(safeNext(formData.get('next')));
}
