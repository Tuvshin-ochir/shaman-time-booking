import path from 'node:path';
import crypto from 'node:crypto';
import { shared } from './lib/shared.js';

// Next.js loads .env itself (next dev / next start); scripts and tests load it
// or set the variables before importing this module.
const env = process.env;
const isProd = env.NODE_ENV === 'production';
const port = Number(env.PORT) || 3000;
// `next build` evaluates server modules without the server's .env, so missing
// settings must not stop the build; they are checked again when the server starts.
const isBuild = env.NEXT_PHASE === 'phase-production-build';

function fail(message) {
  if (isBuild) return undefined;
  throw new Error(`[config] ${message}`);
}

let sessionSecret = env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) fail('SESSION_SECRET заавал тохируулна уу (.env).');
  sessionSecret = shared('devSessionSecret', () => crypto.randomBytes(32).toString('hex'));
}

const qpayMode = (env.QPAY_MODE || 'mock').toLowerCase();
if (!['mock', 'sandbox', 'live'].includes(qpayMode)) fail(`QPAY_MODE буруу: ${qpayMode}`);
if (qpayMode !== 'mock') {
  for (const key of ['QPAY_CLIENT_ID', 'QPAY_CLIENT_SECRET', 'QPAY_INVOICE_CODE']) {
    if (!env[key]) fail(`${key} тохируулаагүй байна (QPAY_MODE=${qpayMode}).`);
  }
}

function parseJson(name, fallback) {
  if (!env[name]) return fallback;
  try {
    return JSON.parse(env[name]);
  } catch {
    return fail(`${name} зөв JSON биш байна.`);
  }
}

export default {
  isProd,
  port,
  baseUrl: (env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  dataDir: path.resolve(/*turbopackIgnore: true*/ env.DATA_DIR || path.join(process.cwd(), 'data')),
  sessionSecret,
  backupKeep: Number(env.BACKUP_KEEP) || 14,
  admin: {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || '',
  },
  qpay: {
    mode: qpayMode,
    baseUrl: (env.QPAY_BASE_URL ||
      (qpayMode === 'sandbox' ? 'https://merchant-sandbox.qpay.mn/v2' : 'https://merchant.qpay.mn/v2')
    ).replace(/\/+$/, ''),
    clientId: env.QPAY_CLIENT_ID || '',
    clientSecret: env.QPAY_CLIENT_SECRET || '',
    invoiceCode: env.QPAY_INVOICE_CODE || '',
  },
  sms: {
    provider: (env.SMS_PROVIDER || 'console').toLowerCase(),
    apiKey: env.SMS_API_KEY || '',
    sender: env.SMS_SENDER || '',
    method: (env.SMS_HTTP_METHOD || 'GET').toUpperCase(),
    url: env.SMS_HTTP_URL || '',
    body: env.SMS_HTTP_BODY || '',
    contentType: env.SMS_HTTP_CONTENT_TYPE || 'application/json',
    headers: parseJson('SMS_HTTP_HEADERS', {}),
    phonePrefix: env.SMS_PHONE_PREFIX || '',
    successMatch: env.SMS_SUCCESS_MATCH || '',
  },
};
