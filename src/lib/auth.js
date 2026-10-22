import crypto from 'node:crypto';
import config from '../config.js';
import { db } from '../db.js';

const COOKIE = 'adm';
const SESSION_MS = 12 * 60 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [alg, n, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, {
    ...SCRYPT,
    N: Number(n),
  });
  return crypto.timingSafeEqual(expected, actual);
}

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Changes whenever the password changes, which logs out every other session.
function passwordVersion(admin) {
  return sign(`pv:${admin.password_hash}`).slice(0, 16);
}

function createSession(admin) {
  const payload = Buffer.from(
    JSON.stringify({ u: admin.id, pv: passwordVersion(admin), exp: Date.now() + SESSION_MS })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSession(value) {
  if (typeof value !== 'string') return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data.exp || data.exp < Date.now()) return null;
  const admin = db().prepare('SELECT * FROM admins WHERE id = ?').get(data.u);
  if (!admin || passwordVersion(admin) !== data.pv) return null;
  return admin;
}

function csrfToken(sessionValue) {
  return sign(`csrf:${sessionValue}`).slice(0, 32);
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/admin', maxAge: SESSION_MS };
}

function findAdmin(username) {
  return db().prepare('SELECT * FROM admins WHERE username = ?').get(String(username || '').trim()) || null;
}

function setPassword(username, password) {
  const hash = hashPassword(password);
  db()
    .prepare(
      `INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`
    )
    .run(username, hash, Date.now());
}

// Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD.
function ensureAdmin() {
  if (db().prepare('SELECT COUNT(*) AS n FROM admins').get().n > 0) return;
  let password = config.admin.password;
  if (!password) {
    if (config.isProd) {
      console.warn('[auth] Админ хэрэглэгч алга. `npm run admin:password -- admin <нууц үг>` ажиллуулна уу.');
      return;
    }
    password = 'admin123';
    console.warn('[auth] Хөгжүүлэлтийн админ үүсгэлээ: admin / admin123 (production-д ашиглахгүй)');
  }
  setPassword(config.admin.username, password);
}

export {  COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  readSession,
  csrfToken,
  cookieOptions,
  findAdmin,
  setPassword,
  ensureAdmin,
  safeEqual,
};
