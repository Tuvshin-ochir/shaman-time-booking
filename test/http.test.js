require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { db } = require('../src/db');

let server;
let base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

const get = (path, opts = {}) => fetch(base + path, { redirect: 'manual', ...opts });
const post = (path, data, opts = {}) =>
  fetch(base + path, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
    body: new URLSearchParams(data).toString(),
  });

async function firstFreeSlot(serviceId) {
  const { days } = await (await get(`/api/days?service=${serviceId}`)).json();
  const day = days.find((d) => d.free > 0);
  const { times } = await (await get(`/api/slots?service=${serviceId}&date=${day.date}`)).json();
  return { date: day.date, time: times[0] };
}

test('public pages render with Open Graph tags', async () => {
  for (const path of ['/', '/services', '/about', '/contact', '/policy', '/book']) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /<meta property="og:image" content="http[^"]+\/img\/og\.jpg">/, path);
    assert.match(html, /Цаг захиалах/, path);
  }
  assert.equal((await get('/nope')).status, 404);
  assert.equal((await get('/robots.txt')).status, 200);
});

test('full booking flow: hold -> pay -> confirmed, double booking rejected', async () => {
  const serviceId = db().prepare('SELECT id FROM services WHERE active = 1 ORDER BY sort, id LIMIT 1').get().id;
  const slot = await firstFreeSlot(serviceId);

  const res = await post('/book', { service_id: serviceId, ...slot, name: 'Болд', phone: '9911 4455', agree: '1' });
  assert.equal(res.status, 303);
  const payUrl = res.headers.get('location');
  assert.match(payUrl, /^\/pay\/[\w-]+$/);
  const token = payUrl.split('/').pop();

  const payPage = await (await get(payUrl)).text();
  assert.match(payPage, /id="countdown"/);

  // Same slot, different customer -> rejected
  const dup = await post('/book', { service_id: serviceId, ...slot, name: 'Дорж', phone: '88114455', agree: '1' });
  assert.equal(dup.status, 422);
  assert.match(await dup.text(), /өөр хүн захиалсан/);

  // The slot no longer shows as free
  const { times } = await (await get(`/api/slots?service=${serviceId}&date=${slot.date}`)).json();
  assert.ok(!times.includes(slot.time));

  assert.equal((await (await get(`/api/booking/${token}/status`)).json()).status, 'pending');
  const paid = await post(`/mock/pay/${token}`, {});
  assert.equal(paid.status, 303);
  assert.equal((await (await get(`/api/booking/${token}/status`)).json()).status, 'confirmed');

  const confirmation = await (await get(`/booking/${token}`)).text();
  assert.match(confirmation, /Захиалга баталгаажлаа/);
  const ics = await get(`/booking/${token}/calendar.ics`);
  assert.match(await ics.text(), /BEGIN:VEVENT/);

  const callback = await get(`/qpay/callback?b=${token}`);
  assert.equal(await callback.text(), 'SUCCESS');
});

test('booking form validates input', async () => {
  const serviceId = db().prepare('SELECT id FROM services WHERE active = 1 ORDER BY sort, id LIMIT 1').get().id;
  const slot = await firstFreeSlot(serviceId);
  const badPhone = await post('/book', { service_id: serviceId, ...slot, name: 'Болд', phone: '12345', agree: '1' });
  assert.equal(badPhone.status, 422);
  assert.match(await badPhone.text(), /Утасны дугаар буруу/);
  const noAgree = await post('/book', { service_id: serviceId, ...slot, name: 'Болд', phone: '99114456' });
  assert.equal(noAgree.status, 422);
});

test('admin requires login and CSRF token', async () => {
  const anon = await get('/admin');
  assert.equal(anon.status, 303);
  assert.match(anon.headers.get('location'), /^\/admin\/login/);

  const wrong = await post('/admin/login', { username: 'admin', password: 'wrong' });
  assert.equal(wrong.status, 401);

  const login = await post('/admin/login', { username: 'admin', password: 'test-password-123' });
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  for (const path of ['/admin', '/admin/bookings', '/admin/bookings/new', '/admin/schedule', '/admin/services', '/admin/settings', '/admin/payments', '/admin/sms']) {
    assert.equal((await get(path, { headers: { cookie } })).status, 200, path);
  }
  const csv = await get('/admin/bookings.csv?view=all&status=all', { headers: { cookie } });
  assert.match(await csv.text(), /Болд/);

  const noCsrf = await post('/admin/holidays', { date_from: '2030-01-01' }, { headers: { cookie } });
  assert.equal(noCsrf.status, 403);

  const page = await (await get('/admin/schedule', { headers: { cookie } })).text();
  const csrf = page.match(/name="_csrf" value="([^"]+)"/)[1];
  const ok = await post('/admin/holidays', { _csrf: csrf, date_from: '2030-01-01', note: 'Шинэ жил' }, { headers: { cookie } });
  assert.equal(ok.status, 303);
  assert.ok(db().prepare(`SELECT 1 FROM holidays WHERE date = '2030-01-01'`).get());
});
