require('./helpers');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const landing = require('../src/lib/landing');
const settings = require('../src/lib/settings');

let server;
let base;
let cookie;
let csrf;

const JPEG = `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'photos', 'khuvsgul-800.jpg')).toString('base64')}`;
const uploads = () => fs.readdirSync(path.join(process.env.DATA_DIR, 'uploads'));

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=test-password-123',
  });
  cookie = login.headers.get('set-cookie').split(';')[0];
  const page = await (await fetch(`${base}/admin/landing`, { headers: { cookie } })).text();
  csrf = page.match(/name="_csrf" value="([^"]+)"/)[1];
});

test.after(() => server.close());

const form = (path, data) =>
  fetch(base + path, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ _csrf: csrf, ...data }).toString(),
  });

const json = (path, data, headers = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...headers },
    body: JSON.stringify(data),
  });

const home = async () => (await fetch(`${base}/`)).text();

test('editor shows every section and saves texts as overrides', async () => {
  const page = await (await fetch(`${base}/admin/landing`, { headers: { cookie } })).text();
  for (const s of landing.SECTIONS) assert.match(page, new RegExp(`id="sec-${s.id}"`));

  const res = await form('/admin/landing', {
    'text:home.cta_title': 'Өнөөдөр цагаа аваарай',
    'text:home.step1': 'Үйлчилгээ, өдөр, цагаа сонгоно', // same as the default -> not stored
    'business:name': 'Бөө Тест',
    'content:home_intro': 'Шинэ танилцуулга',
    'caption:0': 'Шинэ тайлбар',
  });
  assert.equal(res.status, 303);
  assert.deepEqual(settings.get('landing').texts['home.cta_title'], { mn: 'Өнөөдөр цагаа аваарай' });
  assert.equal(settings.get('landing').texts['home.step1'], undefined);

  const html = await home();
  assert.match(html, /Өнөөдөр цагаа аваарай/);
  assert.match(html, /Бөө Тест/);
  assert.match(html, /Шинэ танилцуулга/);
  assert.match(html, /Шинэ тайлбар/);

  // Other content (e.g. the about text) is untouched, and the settings form no longer wipes home texts.
  assert.ok(settings.get('content').about_mn.length > 20);
  await form('/admin/settings/content', { about_mn: 'Тухай' });
  assert.equal(settings.get('content').home_intro_mn, 'Шинэ танилцуулга');

  const empty = await form('/admin/landing', { 'business:name': '' });
  assert.equal(empty.status, 422);
});

test('image upload, reset and orphan cleanup', async () => {
  const bad = await json('/admin/landing/image', { slot: 'hero', large: 'data:image/png;base64,AAAA', width: 100, height: 100 });
  assert.equal(bad.status, 400);
  assert.equal((await json('/admin/landing/image', { slot: 'hero', large: JPEG, width: 800, height: 453 }, { 'X-CSRF-Token': 'x' })).status, 403);

  const ok = await json('/admin/landing/image', { slot: 'hero', large: JPEG, width: 800, height: 453, small: JPEG, smallWidth: 400 });
  assert.equal(ok.status, 200);
  const hero = landing.image('hero');
  assert.match(hero.src, /^\/uploads\/hero-[0-9a-f]{12}\.jpg$/);
  assert.match(await home(), new RegExp(hero.src.replace(/\./g, '\\.')));
  assert.equal((await fetch(base + hero.src)).headers.get('content-type'), 'image/jpeg');

  await json('/admin/landing/image', { slot: 'og', large: JPEG, width: 800, height: 453 });
  assert.match(await home(), /og:image" content="http[^"]+\/uploads\/og-/);

  await json('/admin/landing/image/reset', { slot: 'hero' });
  await json('/admin/landing/image/reset', { slot: 'og' });
  assert.equal(landing.image('hero').src, '/img/photos/hero-1600.jpg');
  assert.deepEqual(uploads(), []);
});

test('gallery add, move, delete and reset', async () => {
  const start = landing.gallery().length;
  assert.equal((await json('/admin/landing/image', { slot: 'gallery', index: '', large: JPEG, width: 800, height: 453 })).status, 200);
  let items = landing.gallery();
  assert.equal(items.length, start + 1);
  assert.match(items.at(-1).src, /^\/uploads\/gallery-/);

  await json('/admin/landing/gallery/move', { index: items.length - 1, direction: 'up' });
  items = landing.gallery();
  assert.match(items.at(-2).src, /^\/uploads\/gallery-/);

  await json('/admin/landing/gallery/delete', { index: items.length - 2 });
  assert.equal(landing.gallery().length, start);
  assert.deepEqual(uploads(), []);

  assert.equal((await json('/admin/landing/gallery/delete', { index: 99 })).status, 400);
  await json('/admin/landing/gallery/reset', {});
  assert.equal(settings.get('landing').gallery, null);
});

test('services: unused ones are deleted, booked ones only hidden', async () => {
  const { db } = require('../src/db');
  const bookings = require('../src/lib/bookings');
  const insert = (name) =>
    Number(
      db()
        .prepare(`INSERT INTO services (name, price, duration_min, active, sort, created_at) VALUES (?, 1000, 30, 1, 0, ?)`)
        .run(name, Date.now()).lastInsertRowid
    );
  const unused = insert('Хоосон үйлчилгээ');
  const used = insert('Захиалгатай үйлчилгээ');
  const booking = bookings.createManual({ serviceId: used, date: '2030-01-07', time: '09:00', name: 'Бат', phone: '99110099', force: true });

  const list = await (await fetch(`${base}/admin/services`, { headers: { cookie } })).text();
  assert.match(list, /ирээдүйн 1 захиалга байна/);

  assert.equal((await form(`/admin/services/${unused}/delete`, {})).status, 303);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM services WHERE id = ?').get(unused).n, 0);

  assert.equal((await form(`/admin/services/${used}/delete`, {})).status, 303);
  const row = db().prepare('SELECT * FROM services WHERE id = ?').get(used);
  assert.ok(row.deleted_at);
  assert.equal(row.active, 0);
  assert.equal(bookings.getById(booking.id).service_name, 'Захиалгатай үйлчилгээ');
  assert.equal(bookings.getService(used, { activeOnly: false }), null);
  assert.doesNotMatch(await (await fetch(`${base}/admin/services`, { headers: { cookie } })).text(), /Захиалгатай үйлчилгээ/);
  assert.equal((await fetch(`${base}/admin/services/${used}`, { headers: { cookie } })).status, 404);
  assert.doesNotMatch(await (await fetch(`${base}/services`)).text(), /Захиалгатай үйлчилгээ/);
});

test('sample services do not come back after the admin deletes them all', () => {
  const { db } = require('../src/db');
  db().exec('DELETE FROM booking_events; DELETE FROM sms_log; DELETE FROM payments; DELETE FROM bookings; DELETE FROM services;');
  require('../src/seed').seed();
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM services').get().n, 0);
});

test('policy page: defaults, then edited through the home page editor', async () => {
  const policy = require('../src/lib/policy');
  let page = await (await fetch(`${base}/policy`)).text();
  assert.match(page, /24 цагаас өмнө/);
  assert.equal((page.match(/class="policy-card /g) || []).length, 3);
  assert.equal((page.match(/class="policy-section"/g) || []).length, 5);
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
  assert.equal((await form('/admin/landing', body)).status, 303);
  const saved = policy.get();
  assert.deepEqual(saved.highlights.map((h) => [h.title_mn, h.tone]), [['Хоёр дахь', 'bad'], ['Эхний', 'good']]);
  assert.equal(saved.sections.length, 1);
  assert.match(saved.updated_at, /^\d{4}-\d{2}-\d{2}$/);

  page = await (await fetch(`${base}/policy`)).text();
  assert.match(page, /Шинэ танилцуулга/);
  assert.match(page, /<p>Нэгдүгээр догол<\/p>\s*<p>Хоёрдугаар догол<\/p>/);
  assert.match(page, /Сүүлд шинэчилсэн/);

  // Saving the editor again without policy changes keeps the "last updated" date.
  settings.set('policy', { ...settings.get('policy'), updated_at: '2000-01-01' });
  await form('/admin/landing', body);
  assert.equal(settings.get('policy').updated_at, '2000-01-01');
  // ...also when the stored rows still carry English texts from an older version.
  const stored = settings.get('policy');
  settings.set('policy', { ...stored, highlights: stored.highlights.map((h) => ({ ...h, title_en: 'Old' })) });
  await form('/admin/landing', body);
  assert.equal(settings.get('policy').updated_at, '2000-01-01');

  const editor = await (await fetch(`${base}/admin/landing`, { headers: { cookie } })).text();
  assert.match(editor, /id="sec-policy"/);
  assert.match(editor, /value="Хоёр дахь"/);
});
