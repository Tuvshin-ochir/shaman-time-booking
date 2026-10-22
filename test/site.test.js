require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const markdown = require('../src/lib/markdown');

let server;
let base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

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

test('usage guide is linked from the login page and readable without logging in', async () => {
  assert.match(await (await fetch(`${base}/admin/login`)).text(), /href="\/admin\/guide"/);
  const res = await fetch(`${base}/admin/guide`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /Сайт ашиглах заавар/);
  assert.match(page, /<h2 id="s1">1\. Нэвтрэх<\/h2>/);
  assert.match(page, /<table>/);
  assert.match(page, /href="\/admin\/login"/);
});

test('site is Mongolian only, and the theme cookie is applied', async () => {
  for (const path of ['/', '/book?service=2', '/services?lang=en']) {
    const page = await (await fetch(base + path)).text();
    assert.match(page, /<html lang="mn">/, path);
    assert.match(page, /data-theme-toggle/, path);
    assert.doesNotMatch(page, /lang=en|hreflang|English/, path);
  }
  assert.match(await (await fetch(`${base}/services?lang=en`)).text(), /Үйлчилгээ ба үнэ/);

  const dark = await (await fetch(`${base}/`, { headers: { cookie: 'theme=dark' } })).text();
  assert.match(dark, /<html lang="mn" data-theme="dark">/);
  const bogus = await (await fetch(`${base}/`, { headers: { cookie: 'theme="><script>' } })).text();
  assert.match(bogus, /<html lang="mn">/);
});
