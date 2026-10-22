const config = require('../config');
const { db } = require('../db');
const settings = require('./settings');

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

async function deliver(to, text) {
  const sms = config.sms;
  if (sms.provider === 'console') {
    console.log(`[sms] -> ${to}: ${text}`);
    return { ok: true, response: 'console (илгээгээгүй, зөвхөн лог)' };
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

module.exports = { send, transliterate };
