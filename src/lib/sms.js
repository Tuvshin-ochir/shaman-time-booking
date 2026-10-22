import config from '../config.js';
import { db } from '../db.js';
import * as settings from './settings.js';

// Informal Mongolian Latin as people text it (ө/ү -> u, х -> h). Latin SMS fit
// 160 chars per segment instead of 70 and work on gateways without Unicode.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'ye', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'u', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: 'i',
  ы: 'ii', ь: 'i', э: 'e', ю: 'yu', я: 'ya',
  '–': '-', '—': '-', '«': '"', '»': '"', '“': '"', '”': '"', '’': "'", '₮': 'tug',
};

function transliterate(text) {
  let out = '';
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = TRANSLIT[lower];
    if (mapped === undefined) out += ch;
    else if (ch !== lower) out += mapped.charAt(0).toUpperCase() + mapped.slice(1);
    else out += mapped;
  }
  return out;
}

function fill(template, vars, encode) {
  return template.replace(/\{(to|text|from|key)\}/g, (_, name) => encode(vars[name] ?? ''));
}

// WeSend (wesend.mn) needs only the API key: https://wesend.mn/docs/sms
const WESEND_URL = 'https://api.wesend.mn/v1/sms';
const WESEND_BALANCE_URL = 'https://api.wesend.mn/v1/balance';

// WeSend error codes (https://wesend.mn/docs/errors) explained for the SMS log.
const WESEND_ERRORS = {
  trial_recipient:
    'WeSend туршилтын (trial) горимд байгаа тул зөвхөн таны баталгаажуулсан дугаар руу илгээнэ. wesend.mn дээр ДАН-аар баталгаажуулж төслөө идэвхжүүлнэ үү.',
  subscription_required: 'WeSend төсөл идэвхгүй байна: ДАН-аар баталгаажаагүй эсвэл сарын төлбөр төлөгдөөгүй.',
  insufficient_credits: 'WeSend-ийн кредит хүрэлцэхгүй байна. wesend.mn-ээс цэнэглэнэ үү.',
  invalid_api_key: 'WeSend-ийн API түлхүүр буруу эсвэл хүчингүй болсон (SMS_API_KEY).',
  unsupported_number: 'Энэ дугаарын операторт WeSend илгээдэггүй.',
  rate_limited: 'Хэт олон SMS зэрэг илгээлээ. Түр хүлээгээд дахин илгээнэ үү.',
  recipient_rate_limited: 'Энэ дугаар руу хэт олон SMS илгээлээ. Түр хүлээгээд дахин илгээнэ үү.',
  provider_failed: 'Оператор SMS-ийг хүлээж аваагүй (кредит буцаагдсан). Дахин илгээж үзнэ үү.',
};

function wesendError(text) {
  try {
    const code = JSON.parse(text).error.code;
    return WESEND_ERRORS[code] ? `${code}: ${WESEND_ERRORS[code]} ` : '';
  } catch {
    return '';
  }
}

async function deliver(to, text) {
  const sms = config.sms;
  if (sms.provider === 'console') {
    console.log(`[sms] -> ${to}: ${text}`);
    return { ok: true, response: 'console (илгээгээгүй, зөвхөн лог)' };
  }
  if (sms.provider === 'wesend') {
    if (!sms.apiKey) throw new Error('SMS_API_KEY (WeSend-ийн API түлхүүр) тохируулаагүй байна');
    const res = await fetch(WESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sms.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: sms.phonePrefix + to, text }),
      signal: AbortSignal.timeout(15000),
    });
    const answer = await res.text();
    return { ok: res.ok, response: `${res.status} ${res.ok ? '' : wesendError(answer)}${answer}`.slice(0, 500) };
  }
  if (sms.provider !== 'http') throw new Error(`Unknown SMS_PROVIDER: ${sms.provider}`);
  if (!sms.url) throw new Error('SMS_HTTP_URL тохируулаагүй байна');

  const vars = { to: sms.phonePrefix + to, text, from: sms.sender, key: sms.apiKey };
  const headers = {};
  for (const [name, value] of Object.entries(sms.headers)) headers[name] = fill(String(value), vars, (s) => s);
  let body;
  if (sms.method !== 'GET' && sms.body) {
    const encode = sms.contentType.includes('json') ? (s) => JSON.stringify(String(s)).slice(1, -1) : encodeURIComponent;
    body = fill(sms.body, vars, encode);
    headers['Content-Type'] = sms.contentType;
  }
  const res = await fetch(fill(sms.url, vars, encodeURIComponent), {
    method: sms.method,
    headers,
    body,
    signal: AbortSignal.timeout(15000),
  });
  const responseText = await res.text();
  const ok = res.ok && (!sms.successMatch || responseText.includes(sms.successMatch));
  return { ok, response: `${res.status} ${responseText.slice(0, 500)}` };
}

// Sends and logs one SMS. Never throws: failures are recorded in sms_log so the
// admin can see and resend them.
async function send(to, body, { bookingId = null, kind = 'manual' } = {}) {
  const text = settings.get('sms').transliterate ? transliterate(body) : body;
  let result;
  try {
    result = await deliver(to, text);
  } catch (err) {
    result = { ok: false, response: String(err.message || err).slice(0, 500) };
  }
  if (!result.ok) console.error(`[sms] failed -> ${to}: ${result.response}`);
  const info = db()
    .prepare(
      `INSERT INTO sms_log (booking_id, kind, to_phone, body, status, provider_response, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(bookingId, kind, to, text, result.ok ? 'sent' : 'failed', result.response, Date.now());
  return { id: Number(info.lastInsertRowid), ok: result.ok };
}

// Checks the gateway without sending an SMS (scripts/check-services.js).
// For WeSend the balance call proves the key works. Returns { ok, detail, balance }.
async function checkProvider() {
  const sms = config.sms;
  if (sms.provider === 'console') return { ok: true, detail: 'console: SMS илгээхгүй, зөвхөн лог руу бичнэ' };
  if (sms.provider === 'http') return { ok: !!sms.url, detail: sms.url ? 'http: түлхүүрийг шалгах боломжгүй' : 'SMS_HTTP_URL хоосон' };
  if (sms.provider !== 'wesend') return { ok: false, detail: `SMS_PROVIDER буруу: ${sms.provider}` };
  if (!sms.apiKey) return { ok: false, detail: 'SMS_API_KEY (WeSend-ийн API түлхүүр) хоосон' };
  const res = await fetch(WESEND_BALANCE_URL, {
    headers: { Authorization: `Bearer ${sms.apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, detail: `WeSend ${res.status}: ${text.slice(0, 200)}` };
  let balance = null;
  try {
    balance = Number(JSON.parse(text).balance);
  } catch {
    // keep null: the key still worked
  }
  return { ok: true, detail: `WeSend түлхүүр ажиллаж байна, үлдэгдэл ${balance ?? '?'} кредит`, balance };
}

export { send, transliterate, checkProvider };
