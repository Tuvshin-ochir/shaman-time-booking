// QPay merchant API v2 client.
//   POST /auth/token     (Basic client_id:client_secret)
//   POST /auth/refresh   (Bearer refresh_token)
//   POST /invoice        create invoice -> invoice_id, qr_image, urls (bank app deeplinks)
//   POST /payment/check  list payments for an invoice
//   DELETE /invoice/:id  cancel an unpaid invoice
// QPAY_MODE=mock replaces all of this with an in-memory fake for development.
import crypto from 'node:crypto';
import config from '../config.js';
import { shared } from './shared.js';

const TIMEOUT_MS = 15000;

// Access token cache: { token, tokenRequest }.
const tokens = shared('qpayAuth', () => ({ token: null, tokenRequest: null }));

// QPay returns expires_in as an epoch timestamp (seconds); tolerate a duration too.
function expiryMs(value, fallbackSeconds) {
  const n = Number(value);
  if (!n) return Date.now() + fallbackSeconds * 1000;
  return n > 1e9 ? n * 1000 : Date.now() + n * 1000;
}

async function request(method, path, { body, auth } = {}) {
  const res = await fetch(config.qpay.baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`QPay ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function fetchToken() {
  const { token } = tokens;
  let data = null;
  if (token && token.refreshExp - 60000 > Date.now()) {
    try {
      data = await request('POST', '/auth/refresh', { auth: `Bearer ${token.refresh}` });
    } catch {
      data = null;
    }
  }
  if (!data) {
    const basic = Buffer.from(`${config.qpay.clientId}:${config.qpay.clientSecret}`).toString('base64');
    data = await request('POST', '/auth/token', { auth: `Basic ${basic}` });
  }
  tokens.token = {
    access: data.access_token,
    refresh: data.refresh_token,
    accessExp: expiryMs(data.expires_in, 3600),
    refreshExp: expiryMs(data.refresh_expires_in, 86400),
  };
  return tokens.token.access;
}

async function accessToken({ force = false } = {}) {
  if (!force && tokens.token && tokens.token.accessExp - 60000 > Date.now()) return tokens.token.access;
  if (force) tokens.token = tokens.token && { ...tokens.token, accessExp: 0 };
  if (!tokens.tokenRequest) tokens.tokenRequest = fetchToken().finally(() => (tokens.tokenRequest = null));
  return tokens.tokenRequest;
}

async function authed(method, path, body) {
  try {
    return await request(method, path, { body, auth: `Bearer ${await accessToken()}` });
  } catch (err) {
    if (err.status !== 401) throw err;
    return request(method, path, { body, auth: `Bearer ${await accessToken({ force: true })}` });
  }
}

// ── Mock provider ─────────────────────────────────────────
const mockInvoices = shared('qpayMockInvoices', () => new Map());

const mock = {
  createInvoice({ amount }) {
    const invoiceId = `MOCK-${crypto.randomBytes(6).toString('hex')}`;
    mockInvoices.set(invoiceId, { amount, paid: false, cancelled: false });
    return {
      invoiceId,
      qrText: invoiceId,
      qrImage: null,
      shortUrl: null,
      deeplinks: [],
      raw: { invoice_id: invoiceId, mock: true },
    };
  },
  checkPayment(invoiceId) {
    const inv = mockInvoices.get(invoiceId);
    const paid = !!(inv && inv.paid);
    return {
      paid,
      paidAmount: paid ? inv.amount : 0,
      paymentId: paid ? `MOCKPAY-${invoiceId}` : null,
      raw: { mock: true, paid },
    };
  },
  cancelInvoice(invoiceId) {
    const inv = mockInvoices.get(invoiceId);
    if (inv) inv.cancelled = true;
  },
  pay(invoiceId) {
    const inv = mockInvoices.get(invoiceId);
    if (!inv || inv.cancelled) return false;
    inv.paid = true;
    return true;
  },
};

// ── Public API ────────────────────────────────────────────
const isMock = () => config.qpay.mode === 'mock';

async function createInvoice({ senderInvoiceNo, amount, description, callbackUrl, receiverCode }) {
  if (isMock()) return mock.createInvoice({ amount });
  const data = await authed('POST', '/invoice', {
    invoice_code: config.qpay.invoiceCode,
    sender_invoice_no: senderInvoiceNo,
    invoice_receiver_code: receiverCode || 'terminal',
    invoice_description: description,
    amount,
    callback_url: callbackUrl,
  });
  return {
    invoiceId: data.invoice_id,
    qrText: data.qr_text || null,
    qrImage: data.qr_image || null,
    shortUrl: data.qPay_shortUrl || null,
    deeplinks: (data.urls || []).map((u) => ({
      name: u.name,
      description: u.description,
      logo: u.logo,
      link: u.link,
    })),
    raw: { invoice_id: data.invoice_id, qPay_shortUrl: data.qPay_shortUrl },
  };
}

async function checkPayment(invoiceId) {
  if (isMock()) return mock.checkPayment(invoiceId);
  const data = await authed('POST', '/payment/check', {
    object_type: 'INVOICE',
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  });
  const paidRows = (data.rows || []).filter((r) => r.payment_status === 'PAID');
  const rowsTotal = paidRows.reduce((sum, r) => sum + Number(r.payment_amount || 0), 0);
  return {
    paid: paidRows.length > 0,
    paidAmount: Math.max(rowsTotal, Number(data.paid_amount || 0)),
    paymentId: paidRows[0] ? String(paidRows[0].payment_id) : null,
    raw: data,
  };
}

async function cancelInvoice(invoiceId) {
  if (isMock()) return mock.cancelInvoice(invoiceId);
  return authed('DELETE', `/invoice/${encodeURIComponent(invoiceId)}`);
}

const mockPay = (invoiceId) => mock.pay(invoiceId);

// Logs in to QPay with a fresh token, which proves the credentials work
// (scripts/check-services.js). Throws with QPay's answer when they do not.
async function checkAuth() {
  if (isMock()) return 'mock';
  await accessToken({ force: true });
  return 'ok';
}

export { createInvoice, checkPayment, cancelInvoice, isMock, mockPay, checkAuth };
