// End-to-end: the built Next.js app over HTTP. Run with `npm run test:e2e`.
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { startServer, client } from './server.js';

let server;
let web;
let admin;
let database;

test.before(async () => {
  server = await startServer();
  web = client(server.base);
  admin = client(server.base);
  database = new DatabaseSync(path.join(server.dataDir, 'app.db'), { readOnly: true });
});

test.after(() => {
  database.close();
  server.stop();
});

const one = (sql, ...params) => database.prepare(sql).get(...params);
const firstServiceId = () => one('SELECT id FROM services WHERE active = 1 ORDER BY sort, id LIMIT 1').id;

async function firstFreeSlot(serviceId, skip = 0) {
  const { days } = await (await web.get(`/api/days?service=${serviceId}`)).json();
  const day = days.find((d) => d.free > skip);
  const { times } = await (await web.get(`/api/slots?service=${serviceId}&date=${day.date}`)).json();
  return { date: day.date, time: times[skip] };
}

test('public pages render with Open Graph tags and security headers', async () => {
  for (const p of ['/', '/services', '/about', '/contact', '/policy', '/book']) {
    const res = await web.get(p);
    assert.equal(res.status, 200, p);
    const html = await res.text();
    assert.match(html, /<meta property="og:image" content="http[^"]+\/img\/og\.jpg"\/>/, p);
    assert.match(html, /<meta property="og:locale" content="mn_MN"\/>/, p);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"\/>/, p);
    assert.match(html, /Цаг захиалах/, p);
    const csp = res.headers.get('content-security-policy');
    const nonce = csp.match(/'nonce-([^']+)'/)[1];
    assert.match(html, new RegExp(`<script[^>]* nonce="${nonce.replace(/[+/=]/g, '\\$&')}"`), p);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  }
  const missing = await web.get('/nope');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Хуудас олдсонгүй/);
  assert.match(await (await web.get('/robots.txt')).text(), /Disallow: \/admin/);
  assert.match(await (await web.get('/sitemap.xml')).text(), /<loc>http[^<]+\/policy<\/loc>/);
});

test('site is Mongolian only, and the theme cookie is applied', async () => {
  for (const p of ['/', '/book?service=2', '/services?lang=en']) {
    // Only the markup people see; the router data repeats the requested URL.
    const page = (await (await web.get(p)).text()).replace(/<script[\s\S]*?<\/script>/g, '');
    assert.match(page, /<html lang="mn"/, p);
    assert.match(page, /class="theme-toggle" role="switch"/, p);
    assert.doesNotMatch(page, /lang=en|hreflang|English/, p);
  }
  const dark = await (await web.get('/', { headers: { cookie: 'theme=dark' } })).text();
  assert.match(dark, /<html lang="mn" data-theme="dark">/);
  const light = await (await web.get('/', { headers: { cookie: 'theme=light' } })).text();
  assert.match(light, /<html lang="mn" data-theme="light">/);
  // Without a valid choice: dark after sunset in Ulaanbaatar, otherwise the device setting.
  const { isNight } = await import('../../src/lib/sun.js');
  const bogus = await (await web.get('/', { headers: { cookie: 'theme="><script>' } })).text();
  assert.match(bogus, isNight() ? /<html lang="mn" data-theme="dark">/ : /<html lang="mn">/);
});

test('full booking flow: hold -> pay -> confirmed, double booking rejected', async () => {
  const serviceId = firstServiceId();
  const slot = await firstFreeSlot(serviceId);

  const res = await web.submit('/book', 'id="book-form"', { service_id: serviceId, ...slot, name: 'Болд', phone: '9911 4455', agree: '1' });
  assert.equal(res.status, 303);
  const payUrl = res.headers.get('location');
  assert.match(payUrl, /^\/pay\/[\w-]+$/);
  const token = payUrl.split('/').pop();

  const payPage = await web.get(payUrl);
  assert.match(await payPage.text(), /id="countdown"/);
  assert.equal(payPage.headers.get('x-robots-tag'), 'noindex');

  // Same slot, different customer -> rejected (the form is shown again).
  const dup = await web.submit('/book', 'id="book-form"', { service_id: serviceId, ...slot, name: 'Дорж', phone: '88114455', agree: '1' });
  assert.notEqual(dup.status, 303);
  assert.equal(one(`SELECT COUNT(*) AS n FROM bookings WHERE phone = '88114455'`).n, 0);

  // The slot no longer shows as free.
  const { times } = await (await web.get(`/api/slots?service=${serviceId}&date=${slot.date}`)).json();
  assert.ok(!times.includes(slot.time));

  assert.equal((await (await web.get(`/api/booking/${token}/status`)).json()).status, 'pending');
  const paid = await fetch(`${server.base}/mock/pay/${token}`, { method: 'POST', redirect: 'manual' });
  assert.equal(paid.status, 303);
  assert.equal(paid.headers.get('location'), `/booking/${token}`);
  assert.equal((await (await web.get(`/api/booking/${token}/status`)).json()).status, 'confirmed');

  assert.match(await (await web.get(`/booking/${token}`)).text(), /Захиалга баталгаажлаа/);
  assert.equal((await web.get(payUrl)).status, 307); // paid: the payment page sends you to the booking
  assert.match(await (await web.get(`/booking/${token}/calendar.ics`)).text(), /BEGIN:VEVENT/);
  assert.equal(await (await web.get(`/qpay/callback?b=${token}`)).text(), 'SUCCESS');
  assert.equal(await (await fetch(`${server.base}/qpay/callback?b=${token}`, { method: 'POST' })).text(), 'SUCCESS');
});

test('booking form validates input', async () => {
  const serviceId = firstServiceId();
  const slot = await firstFreeSlot(serviceId, 1);
  const before = one('SELECT COUNT(*) AS n FROM bookings').n;
  const badPhone = await web.submit('/book', 'id="book-form"', { service_id: serviceId, ...slot, name: 'Болд', phone: '12345', agree: '1' });
  assert.notEqual(badPhone.status, 303);
  const noAgree = await web.submit('/book', 'id="book-form"', { service_id: serviceId, ...slot, name: 'Болд', phone: '99114456' });
  assert.notEqual(noAgree.status, 303);
  assert.equal(one('SELECT COUNT(*) AS n FROM bookings').n, before);
});

test('admin requires login; actions need a session and the same origin', async () => {
  const anon = await web.get('/admin/bookings?view=all');
  assert.equal(anon.status, 307);
  assert.equal(anon.headers.get('location'), '/admin/login?next=%2Fadmin%2Fbookings%3Fview%3Dall');

  const wrong = await admin.submit('/admin/login', 'name="username"', { username: 'admin', password: 'wrong' });
  assert.notEqual(wrong.status, 303);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const login = await admin.submit('/admin/login?next=%2Fadmin%2Fsms', 'name="username"', { username: 'admin', password: 'test-password-123', next: '/admin/sms' });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get('location'), '/admin/sms');
  assert.match(login.headers.get('set-cookie'), /^adm=.+; Path=\/admin; .*HttpOnly/i);

  for (const p of ['/admin', '/admin/bookings', '/admin/bookings/new', '/admin/schedule', '/admin/services', '/admin/services/new', '/admin/news', '/admin/news/new', '/admin/settings', '/admin/landing', '/admin/payments', '/admin/sms']) {
    const res = await admin.get(p);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex', p);
  }
  assert.match(await (await admin.get('/admin/bookings.csv?view=all&status=all')).text(), /Болд/);
  assert.equal((await web.get('/admin/bookings.csv')).status, 303);
  assert.equal((await web.get('/admin/api/slots?date=2030-01-07&service=1')).status, 401);
  assert.equal((await admin.get('/admin/backup')).headers.get('content-type'), 'application/octet-stream');

  const ok = await admin.submit('/admin/schedule', 'name="date_from"', { date_from: '2030-01-01', note: 'Шинэ жил' });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('location'), '/admin/schedule?ok=holiday');
  assert.ok(one(`SELECT 1 AS x FROM holidays WHERE date = '2030-01-01'`));

  // Closing hours on one date takes them off the public booking page; reopening brings them back.
  const serviceId = firstServiceId();
  const free = await firstFreeSlot(serviceId);
  const freeTimes = async () => (await (await web.get(`/api/slots?service=${serviceId}&date=${free.date}`)).json()).times;
  assert.ok((await freeTimes()).includes(free.time));
  const end = `${String(Number(free.time.slice(0, 2)) + 1).padStart(2, '0')}${free.time.slice(2)}`;
  const blocked = await admin.submit('/admin/schedule', 'name="start"', { date: free.date, start: free.time, end, note: 'Гадуур' });
  assert.equal(blocked.headers.get('location'), '/admin/schedule?ok=block');
  assert.ok(!(await freeTimes()).includes(free.time));
  assert.match(await (await admin.get('/admin/schedule')).text(), /Гадуур/);
  const reopened = await admin.submit('/admin/schedule', 'type="submit">Нээх<');
  assert.equal(reopened.headers.get('location'), '/admin/schedule?ok=block_deleted');
  assert.ok((await freeTimes()).includes(free.time));

  // The same form without a session, or posted from another site, changes nothing.
  const html = await (await admin.get('/admin/schedule')).text();
  const { actionFields } = await import('./server.js');
  const body = () => {
    const fd = new FormData();
    for (const [name, value] of actionFields(html, 'name="date_from"')) fd.append(name, value);
    fd.append('date_from', '2030-02-02');
    return fd;
  };
  await fetch(`${server.base}/admin/schedule`, { method: 'POST', body: body(), redirect: 'manual', headers: { Origin: server.base } });
  await fetch(`${server.base}/admin/schedule`, { method: 'POST', body: body(), redirect: 'manual', headers: { Origin: 'https://evil.example' } });
  assert.equal(one(`SELECT COUNT(*) AS n FROM holidays WHERE date = '2030-02-02'`).n, 0);
});

test('admin: manual booking, services delete, settings and home page editor', async () => {
  // Manual booking for the second service, so that service has history; sent
  // from the "+ Захиалга нэмэх" dialog of the dashboard.
  const used = one('SELECT id FROM services WHERE active = 1 ORDER BY sort, id LIMIT 1 OFFSET 1').id;
  assert.match(await (await admin.get('/admin')).text(), /<dialog class="a-modal"[\s\S]*id="service_id"/);
  const created = await admin.submit('/admin', 'id="service_id"', {
    service_id: used,
    date: '2030-01-07',
    time: '09:00',
    name: 'Гараар',
    phone: '99110099',
    force: 'on',
  });
  assert.equal(created.status, 303);
  assert.match(created.headers.get('location'), /^\/admin\/bookings\/\d+\?ok=created$/);
  const bookingPage = created.headers.get('location').split('?')[0];

  const noted = await admin.submit(bookingPage, 'name="admin_note"', { admin_note: 'Дотоод' });
  assert.match(noted.headers.get('location'), /\?ok=note$/);
  const cancelled = await admin.submit(bookingPage, 'name="reason"', { reason: 'Тест', notify: 'on' });
  assert.match(cancelled.headers.get('location'), /\?ok=cancelled$/);
  assert.equal(one('SELECT status FROM bookings WHERE customer_name = ?', 'Гараар').status, 'cancelled');

  // A new, never booked service (added from the list's dialog) is removed; a booked one is only hidden.
  const added = await admin.submit('/admin/services', 'name="duration_min"', { name: 'Хоосон үйлчилгээ', price: '1000', duration_min: '30', active: 'on' });
  assert.equal(added.headers.get('location'), '/admin/services?ok=saved');
  const unused = one(`SELECT id FROM services WHERE name = 'Хоосон үйлчилгээ'`).id;
  const servicesPage = await (await admin.get('/admin/services')).text();
  assert.match(servicesPage, /Хоосон үйлчилгээ/);
  assert.equal((await admin.submit(`/admin/services/${unused}`, 'inline-form')).status, 303);
  assert.equal(one('SELECT COUNT(*) AS n FROM services WHERE id = ?', unused).n, 0);
  assert.equal((await admin.submit(`/admin/services/${used}`, 'inline-form')).status, 303);
  const row = one('SELECT * FROM services WHERE id = ?', used);
  assert.ok(row.deleted_at);
  assert.equal(row.active, 0);
  assert.equal((await admin.get(`/admin/services/${used}`)).status, 404);
  assert.doesNotMatch(await (await web.get('/services')).text(), new RegExp(row.name));

  // Settings
  const saved = await admin.submit('/admin/settings', 'id="business"', {
    name: 'Бөө Тест',
    tagline: 'Шинэ уриа',
    phone: '9900-1111',
    email: '',
    address: 'Улаанбаатар',
    map_url: '',
    facebook_url: '',
  });
  assert.equal(saved.headers.get('location'), '/admin/settings?ok=saved');
  const home = await (await web.get('/')).text();
  assert.match(home, /<title>Бөө Тест — Цаг захиалах<\/title>/);
  assert.match(home, /Шинэ уриа/);

  // Home page editor (texts and policy), then the public pages.
  const editor = await admin.submit('/admin/landing', 'id="landing-form"', {
    'text:home.cta_title': 'Өнөөдөр цагаа аваарай',
    'business:name': 'Бөө Тест',
    'policy:intro': 'Шинэ нөхцөл',
    'highlight:a:tone': 'bad',
    'highlight:a:title': 'Ганц дүрэм',
    'highlight:a:text': 'Тайлбар',
  });
  assert.equal(editor.status, 200);
  assert.match(await (await web.get('/')).text(), /Өнөөдөр цагаа аваарай/);
  const policyPage = await (await web.get('/policy')).text();
  assert.match(policyPage, /Шинэ нөхцөл/);
  assert.equal((policyPage.match(/class="policy-card /g) || []).length, 1);
});

test('home page images: upload and serve', async () => {
  const page = await (await admin.get('/admin/landing')).text();
  const csrf = page.match(/csrf\\?"\s*:\s*\\?"([\w-]{32})/)[1];
  const JPEG = `data:image/jpeg;base64,${fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'public', 'img', 'photos', 'khuvsgul-800.jpg')).toString('base64')}`;
  const send = (body, token = csrf) =>
    admin.get('/admin/landing/image', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token } });

  assert.equal((await send({ slot: 'hero', large: JPEG, width: 800, height: 453 }, 'x'.repeat(32))).status, 403);
  assert.equal((await send({ slot: 'hero', large: 'data:image/png;base64,AAAA', width: 100, height: 100 })).status, 400);
  assert.equal((await send({ slot: 'hero', large: JPEG, width: 800, height: 453, small: JPEG, smallWidth: 400 })).status, 200);

  const src = (await (await web.get('/')).text()).match(/\/uploads\/hero-[0-9a-f]{12}\.jpg/)[0];
  const image = await web.get(src);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.match(image.headers.get('cache-control'), /immutable/);

  assert.equal((await web.get('/uploads/..%2Fapp.db')).status, 404);
});

test('news: added from the dialog, shown on the site, drafts hidden, edited and deleted', async () => {
  assert.equal((await web.get('/admin/news')).status, 307);
  assert.doesNotMatch(await (await web.get('/')).text(), /section-news/);

  // The "+ Мэдээ нэмэх" dialog form, sent like a browser would (the editor's HTML in `body`).
  assert.match(await (await admin.get('/admin/news')).text(), /<dialog class="a-modal a-modal-wide"[\s\S]*name="title"/);
  const body = '<p>Сайн <b>байна</b> уу<script>alert(1)</script></p><h2>Анхаар</h2><ul><li>нэг</li></ul><a href="javascript:alert(1)">x</a>';
  const added = await admin.submit('/admin/news', 'name="title"', { title: 'Цагаан сарын амралт', date: '2030-01-05', body, published: 'on' });
  assert.equal(added.status, 303);
  assert.equal(added.headers.get('location'), '/admin/news?ok=news_saved');
  const id = one(`SELECT id FROM news WHERE title = 'Цагаан сарын амралт'`).id;
  assert.equal(one('SELECT body FROM news WHERE id = ?', id).body, '<p>Сайн <strong>байна</strong> уу</p><h2>Анхаар</h2><ul><li>нэг</li></ul>x');

  const empty = await admin.submit('/admin/news', 'name="title"', { title: 'Хоосон', date: '2030-01-06', body: '<p><br></p>', published: 'on' });
  assert.notEqual(empty.status, 303);
  assert.equal(one(`SELECT COUNT(*) AS n FROM news WHERE title = 'Хоосон'`).n, 0);

  // On the home page (above the gallery), on /news, on its own page and in the sitemap.
  const home = await (await web.get('/')).text();
  assert.match(home, new RegExp(`section-news[\\s\\S]*href="/news/${id}"[\\s\\S]*Цагаан сарын амралт[\\s\\S]*Мөнх хөх тэнгэр`));
  assert.match(await (await web.get('/news')).text(), new RegExp(`href="/news/${id}"`));
  const page = await web.get(`/news/${id}`);
  assert.equal(page.status, 200);
  const article = await page.text();
  assert.match(article, /<h1>Цагаан сарын амралт<\/h1>/);
  assert.match(article, /<div class="news-content"><p>Сайн <strong>байна<\/strong> уу<\/p><h2>Анхаар<\/h2>/);
  assert.match(article, /<meta name="description" content="Сайн байна уу Анхаар нэг x"\/>/);
  assert.doesNotMatch(article, /alert\(1\)/);
  assert.match(await (await web.get('/sitemap.xml')).text(), new RegExp(`/news/${id}</loc>`));

  // A draft is not on the site until it is published.
  await admin.submit('/admin/news', 'name="title"', { title: 'Ноорог мэдээ', date: '2030-01-07', body: '<p>Удахгүй</p>' });
  const draft = one(`SELECT id, published FROM news WHERE title = 'Ноорог мэдээ'`);
  assert.equal(draft.published, 0);
  assert.equal((await web.get(`/news/${draft.id}`)).status, 404);
  assert.doesNotMatch(await (await web.get('/news')).text(), /Ноорог мэдээ/);
  const published = await admin.submit(`/admin/news/${draft.id}`, 'name="title"', { title: 'Нийтэлсэн мэдээ', date: '2030-01-07', body: '<p>Одоо</p>', published: 'on' });
  assert.equal(published.headers.get('location'), '/admin/news?ok=news_saved');
  assert.equal((await web.get(`/news/${draft.id}`)).status, 200);

  // Delete from the edit page.
  const deleted = await admin.submit(`/admin/news/${draft.id}`, 'Мэдээг устгах');
  assert.equal(deleted.headers.get('location'), '/admin/news?ok=news_deleted');
  assert.equal((await web.get(`/news/${draft.id}`)).status, 404);
  assert.equal(one('SELECT COUNT(*) AS n FROM news').n, 1);
  assert.equal((await web.get('/news/abc')).status, 404);
});

test('special service: added as «Тусгай», booked by day only on the site and in the admin', async () => {
  const added = await admin.submit('/admin/services', 'name="duration_min"', { kind: 'special', name: 'Тусгай засал', price: '20000', active: 'on' });
  assert.equal(added.headers.get('location'), '/admin/services?ok=saved');
  const s = one(`SELECT * FROM services WHERE name = 'Тусгай засал'`);
  assert.equal(s.kind, 'special');
  assert.equal(s.duration_min, 0);
  assert.match(await (await admin.get('/admin/services')).text(), /badge-special/);
  assert.match(await (await web.get('/services')).text(), /Өдөр сонгож захиална/);

  // Days come without times; the form is sent with a day only.
  const { days } = await (await web.get(`/api/days?service=${s.id}`)).json();
  const day = days.find((d) => d.free > 0);
  assert.deepEqual((await (await web.get(`/api/slots?service=${s.id}&date=${day.date}`)).json()).times, []);
  const res = await web.submit('/book', 'id="book-form"', { service_id: s.id, date: day.date, name: 'Өдрийн', phone: '99114470', agree: '1' });
  assert.equal(res.status, 303);
  const token = res.headers.get('location').split('/').pop();
  const row = one('SELECT * FROM bookings WHERE token = ?', token);
  assert.equal(row.day_only, 1);
  assert.equal(row.start_min, 0);

  await fetch(`${server.base}/mock/pay/${token}`, { method: 'POST', redirect: 'manual' });
  const page = await (await web.get(`/booking/${token}`)).text();
  assert.match(page, /Захиалга баталгаажлаа/);
  assert.match(page, /<dt>Өдөр<\/dt>/);
  assert.match(await (await web.get(`/booking/${token}/calendar.ics`)).text(), new RegExp(`DTSTART;VALUE=DATE:${day.date.replace(/-/g, '')}`));

  // Admin: a manual booking of the special service needs no time either.
  const created = await admin.submit('/admin', 'id="service_id"', { service_id: s.id, date: day.date, name: 'Гар тусгай', phone: '99110098' });
  assert.equal(created.status, 303);
  const manual = one(`SELECT * FROM bookings WHERE customer_name = 'Гар тусгай'`);
  assert.equal(manual.day_only, 1);
  assert.match(await (await admin.get(`/admin/bookings/${manual.id}`)).text(), /Өдөр шилжүүлэх/);
});

test('usage guide is public and linked from the login page; logout clears the session', async () => {
  assert.match(await (await web.get('/admin/login')).text(), /href="\/admin\/guide"/);
  const guide = await web.get('/admin/guide');
  assert.equal(guide.status, 200);
  const html = await guide.text();
  assert.match(html, /Сайт ашиглах заавар/);
  assert.match(html, /<h2 id="s1">1\. Нэвтрэх<\/h2>/);
  assert.match(html, /href="\/admin\/login"/);

  const out = await admin.submit('/admin', 'Гарах');
  assert.equal(out.status, 303);
  assert.equal(out.headers.get('location'), '/admin/login');
  assert.match(out.headers.get('set-cookie'), /^adm=;/);
});
