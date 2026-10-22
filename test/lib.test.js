import './helpers.js';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.js';
import { seed } from '../src/seed.js';
import * as settings from '../src/lib/settings.js';
import * as landing from '../src/lib/landing.js';
import * as policy from '../src/lib/policy.js';
import * as markdown from '../src/lib/markdown.js';
import * as i18n from '../src/i18n/index.js';
import * as sun from '../src/lib/sun.js';

const JPEG = `data:image/jpeg;base64,${fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'img', 'photos', 'khuvsgul-800.jpg')).toString('base64')}`;
const uploads = () => fs.readdirSync(path.join(process.env.DATA_DIR, 'uploads'));
const defaults = i18n.translator();

test('home page editor saves texts as overrides of the defaults', () => {
  landing.saveTexts(
    {
      'text:home.cta_title': 'Өнөөдөр цагаа аваарай',
      'text:home.eyebrow': defaults('home.eyebrow'), // same as the default -> not stored
      'business:name': 'Бөө Тест',
      'content:home_intro': 'Шинэ танилцуулга',
      'caption:0': 'Шинэ тайлбар',
    },
    defaults
  );
  assert.deepEqual(settings.get('landing').texts['home.cta_title'], { mn: 'Өнөөдөр цагаа аваарай' });
  assert.equal(settings.get('landing').texts['home.eyebrow'], undefined);
  assert.equal(i18n.siteTranslator()('home.cta_title'), 'Өнөөдөр цагаа аваарай');
  assert.equal(settings.get('business').name, 'Бөө Тест');
  assert.equal(settings.get('content').home_intro_mn, 'Шинэ танилцуулга');
  assert.equal(landing.gallery()[0].caption_mn, 'Шинэ тайлбар');
  // Fields that are not in the form stay as they are.
  assert.ok(settings.get('content').about_mn.length > 20);
  assert.throws(() => landing.saveTexts({ 'business:name': '' }, defaults), landing.LandingError);
});

test('image upload, reset and orphan cleanup', () => {
  assert.throws(() => landing.setImage('hero', { large: 'data:image/png;base64,AAAA', width: 100, height: 100 }), landing.LandingError);
  landing.setImage('hero', { large: JPEG, width: 800, height: 453, small: JPEG, smallWidth: 400 });
  assert.match(landing.image('hero').src, /^\/uploads\/hero-[0-9a-f]{12}\.jpg$/);
  landing.setImage('og', { large: JPEG, width: 800, height: 453 });
  assert.equal(uploads().length, 2);
  landing.resetImage('hero');
  landing.resetImage('og');
  assert.equal(landing.image('hero').src, '/img/photos/hero-1600.jpg');
  assert.deepEqual(uploads(), []);
});

test('gallery add, move, delete and reset', () => {
  const start = landing.gallery().length;
  landing.setGalleryImage('', { large: JPEG, width: 800, height: 453 });
  let items = landing.gallery();
  assert.equal(items.length, start + 1);
  assert.match(items.at(-1).src, /^\/uploads\/gallery-/);

  landing.moveGalleryImage(items.length - 1, 'up');
  items = landing.gallery();
  assert.match(items.at(-2).src, /^\/uploads\/gallery-/);

  landing.deleteGalleryImage(items.length - 2);
  assert.equal(landing.gallery().length, start);
  assert.deepEqual(uploads(), []);

  assert.throws(() => landing.deleteGalleryImage(99), landing.LandingError);
  landing.resetGallery();
  assert.equal(settings.get('landing').gallery, null);
});

test('policy: defaults, edits from the editor, and the "last updated" date', () => {
  assert.equal(policy.get().highlights.length, 3);
  assert.equal(policy.get().sections.length, 5);
  assert.equal(settings.get('policy').updated_at, null);

  // Rows are saved in the order they appear in the form; blank rows are dropped.
  const body = {
    'policy:intro': 'Шинэ танилцуулга',
    'highlight:b:tone': 'bad',
    'highlight:b:title': 'Хоёр дахь',
    'highlight:b:text': 'Б',
    'highlight:a:tone': 'nonsense',
    'highlight:a:title': 'Эхний',
    'highlight:a:text': 'А',
    'highlight:blank:tone': 'good',
    'highlight:blank:title': '',
    'section:z:title': 'Ганц хэсэг',
    'section:z:body': 'Нэгдүгээр догол\n\nХоёрдугаар догол',
  };
  policy.save(body);
  const saved = policy.get();
  assert.deepEqual(saved.highlights.map((h) => [h.title_mn, h.tone]), [['Хоёр дахь', 'bad'], ['Эхний', 'good']]);
  assert.equal(saved.sections.length, 1);
  assert.match(saved.updated_at, /^\d{4}-\d{2}-\d{2}$/);

  // Saving again without policy changes keeps the date...
  settings.set('policy', { ...settings.get('policy'), updated_at: '2000-01-01' });
  policy.save(body);
  assert.equal(settings.get('policy').updated_at, '2000-01-01');
  // ...also when the stored rows still carry English texts from an older version.
  const stored = settings.get('policy');
  settings.set('policy', { ...stored, highlights: stored.highlights.map((h) => ({ ...h, title_en: 'Old' })) });
  policy.save(body);
  assert.equal(settings.get('policy').updated_at, '2000-01-01');
});

test('sample services do not come back after the admin deletes them all', () => {
  db().exec('DELETE FROM booking_events; DELETE FROM sms_log; DELETE FROM payments; DELETE FROM bookings; DELETE FROM services;');
  seed();
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM services').get().n, 0);
});

test('markdown renderer handles the constructs used in the admin guide', () => {
  const { title, toc, html } = markdown.render(
    [
      '# Гарчиг',
      '',
      'Эхний мөр',
      '**Тод** ба *налуу* `код <x>` https://example.com/a?b=1.',
      '',
      '## 1. Хэсэг',
      '',
      '- нэг',
      '  - дэд',
      '- хоёр',
      '1. алхам',
      '',
      '> анхааруулга',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | <script> |',
    ].join('\n')
  );
  assert.equal(title, 'Гарчиг');
  assert.deepEqual(toc, [{ id: 's1', text: '1. Хэсэг' }]);
  assert.match(html, /<p>Эхний мөр<br><strong>Тод<\/strong> ба <em>налуу<\/em> <code>код &lt;x&gt;<\/code> <a href="https:\/\/example.com\/a\?b=1"/);
  assert.match(html, /<ul><li>нэг<ul><li>дэд<\/li><\/ul><\/li><li>хоёр<\/li><\/ul>/);
  assert.match(html, /<ol><li>алхам<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>анхааруулга<\/p><\/blockquote>/);
  assert.match(html, /<td>&lt;script&gt;<\/td>/);
});

test('sun and moon over Ulaanbaatar', () => {
  const ub = (iso) => new Date(`${iso}+08:00`).getTime();
  const near = (actual, expected, minutes, label) => assert.ok(Math.abs(actual - ub(expected)) <= minutes * 60000, `${label}: ${new Date(actual).toISOString()}`);
  // Winter solstice: sunrise 08:40, sunset 17:01 local time.
  const rise = sun.nextSunChange(new Date(ub('2026-12-21T00:00:00'))).getTime();
  near(rise, '2026-12-21T08:40:00', 4, 'sunrise');
  near(sun.nextSunChange(new Date(rise + 60000)).getTime(), '2026-12-21T17:01:00', 4, 'sunset');
  assert.equal(sun.isNight(new Date(ub('2026-12-21T07:00:00'))), true);
  assert.equal(sun.isNight(new Date(ub('2026-12-21T12:00:00'))), false);
  // Midday sun stands in the south, about 66° high at the summer solstice.
  const noon = sun.sunPosition(new Date(ub('2026-06-21T12:54:00')));
  assert.ok(Math.abs(noon.altitude - 65.5) < 1 && Math.abs(noon.azimuth) < 3, JSON.stringify(noon));
  // Full moon at the lunar eclipse of 3 March 2026, new moon at the solar eclipse of 12 August 2026.
  assert.ok(Math.abs(sun.moonPhase(new Date('2026-03-03T11:33:00Z')) - 0.5) < 0.03);
  const phase = sun.moonPhase(new Date('2026-08-12T17:46:00Z'));
  assert.ok(Math.min(phase, 1 - phase) < 0.03, String(phase));
});

test('WeSend: POST with the API key, failures are logged, the deploy check reads the balance', async () => {
  const { default: config } = await import('../src/config.js');
  const sms = await import('../src/lib/sms.js');
  const saved = { ...config.sms };
  const realFetch = globalThis.fetch;
  const calls = [];
  let reply = { status: 200, body: '{"id":"m1","status":"sent","balance":120}' };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(reply.body, { status: reply.status });
  };
  try {
    Object.assign(config.sms, { provider: 'wesend', apiKey: 'test-key', phonePrefix: '' });
    settings.set('sms', { ...settings.get('sms'), transliterate: true });
    const sent = await sms.send('99112233', 'Захиалга баталгаажлаа');
    assert.equal(sent.ok, true);
    assert.equal(calls[0].url, 'https://api.wesend.mn/v1/sms');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
    assert.deepEqual(JSON.parse(calls[0].init.body), { to: '99112233', text: 'Zahialga batalgaajlaa' });

    reply = { status: 403, body: '{"error":{"code":"trial_recipient"}}' };
    const failed = await sms.send('88112233', 'Test');
    assert.equal(failed.ok, false);
    const row = db().prepare('SELECT * FROM sms_log WHERE id = ?').get(failed.id);
    assert.equal(row.status, 'failed');
    assert.match(row.provider_response, /^403 trial_recipient: WeSend туршилтын .*ДАН/);

    config.sms.apiKey = '';
    assert.equal((await sms.send('99112233', 'Test')).ok, false);
    assert.equal(calls.length, 2); // no request without a key
    assert.equal((await sms.checkProvider()).ok, false);

    // The deploy check asks for the balance (no SMS is sent).
    config.sms.apiKey = 'test-key';
    reply = { status: 200, body: '{"balance":1600}' };
    assert.deepEqual(await sms.checkProvider(), { ok: true, detail: 'WeSend түлхүүр ажиллаж байна, үлдэгдэл 1600 кредит', balance: 1600 });
    assert.equal(calls.at(-1).url, 'https://api.wesend.mn/v1/balance');
    reply = { status: 401, body: '{"error":{"code":"invalid_api_key"}}' };
    const bad = await sms.checkProvider();
    assert.equal(bad.ok, false);
    assert.match(bad.detail, /401.*invalid_api_key/);
  } finally {
    globalThis.fetch = realFetch;
    Object.assign(config.sms, saved);
  }
});
