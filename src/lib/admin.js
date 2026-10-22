// Server-side helpers for the admin pages and actions (src/app/(admin-*)).
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '../db.js';
import * as auth from './auth.js';
import * as settings from './settings.js';
import { nowLocal, fromMin } from './time.js';

const field = (value) => String(value ?? '').trim();
const checked = (value) => value === 'on' || value === '1' || value === 'true';

function formatTs(ms) {
  if (!ms) return '';
  const { date, minutes } = nowLocal(ms);
  return `${date.replace(/-/g, '.')} ${fromMin(minutes)}`;
}

async function sessionCookie() {
  return (await cookies()).get(auth.COOKIE)?.value;
}

async function currentAdmin() {
  return auth.readSession(await sessionCookie());
}

// Every admin page and action starts with this. Without a valid session the
// visitor goes to the login page and comes back afterwards.
async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) {
    const url = (await headers()).get('x-url') || '/admin';
    redirect(`/admin/login?next=${encodeURIComponent(url.startsWith('/admin') ? url : '/admin')}`);
  }
  return admin;
}

async function setSessionCookie(admin) {
  const { maxAge, ...options } = auth.cookieOptions();
  (await cookies()).set(auth.COOKIE, auth.createSession(admin), { ...options, maxAge: maxAge / 1000 });
}

async function clearSessionCookie() {
  (await cookies()).delete({ name: auth.COOKIE, path: '/admin' });
}

// After a change: refresh every page (sidebar counters, site header, ...) and go to `url`.
function done(url) {
  revalidatePath('/', 'layout');
  redirect(url);
}

// Counters shown next to sidebar items.
function navBadges() {
  return {
    bookings: db().prepare(`SELECT COUNT(*) AS n FROM bookings WHERE refund_status = 'pending'`).get().n,
    sms: db().prepare(`SELECT COUNT(*) AS n FROM sms_log WHERE status = 'failed' AND created_at > ?`).get(Date.now() - 7 * 86400000).n,
  };
}

function adminMetadata(pageTitle) {
  const name = settings.get('business').name;
  return {
    title: `${pageTitle ? `${pageTitle} · ` : ''}Админ · ${name}`,
    robots: { index: false, follow: false },
    icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
  };
}

export {
  field,
  checked,
  formatTs,
  sessionCookie,
  currentAdmin,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  done,
  navBadges,
  adminMetadata,
};
