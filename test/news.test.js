import './helpers.js';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db.js';
import * as news from '../src/lib/news.js';
import * as landing from '../src/lib/landing.js';
import { sanitize, toText } from '../src/lib/rich-text.js';

const JPEG = `data:image/jpeg;base64,${fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'img', 'photos', 'khuvsgul-800.jpg')).toString('base64')}`;
const PICTURE = { large: JPEG, width: '800', height: '453', small: JPEG, smallWidth: '400' };
const newsFiles = () => {
  try {
    return fs.readdirSync(path.join(process.env.DATA_DIR, 'uploads')).filter((f) => f.startsWith('news-'));
  } catch {
    return [];
  }
};
const post = (overrides = {}) => ({ title: 'Мэдээ', body: '<p>Текст</p>', date: '2030-01-05', published: true, ...overrides });

test('editor HTML keeps formatting and loses everything dangerous', () => {
  // Formatting the editor makes; b/i/div from browsers become strong/em/p.
  assert.equal(
    sanitize('<p><b>Тод</b> <i>налуу</i> <u>зураас</u></p><h2>Гарчиг</h2><blockquote>Ишлэл</blockquote><ol><li>нэг</li></ol>'),
    '<p><strong>Тод</strong> <em>налуу</em> <u>зураас</u></p><h2>Гарчиг</h2><blockquote>Ишлэл</blockquote><ol><li>нэг</li></ol>'
  );
  // Scripts, styles and their content, event handlers, styles, unknown tags, comments.
  assert.equal(
    sanitize('<p onclick="x()" style="color:red">a<script>alert(1)</script><style>p{}</style><!-- note --><img src=x onerror=alert(1)><span>b</span></p>'),
    '<p>ab</p>'
  );
  assert.equal(sanitize('<iframe src="https://evil.example"></iframe><svg><script>alert(1)</script></svg>ok'), 'ok');
  // Links: only http(s), mailto, tel and site paths; outside links open in a new tab.
  assert.equal(sanitize('<a href="javascript:alert(1)">x</a>'), 'x');
  assert.equal(sanitize('<a href=" JaVaScRiPt:alert(1)">x</a><a href="data:text/html,hi">y</a>'), 'xy');
  assert.equal(
    sanitize('<a href="https://e.mn/?a=1&amp;b=&quot;2" onclick="x">e</a>'),
    '<a href="https://e.mn/?a=1&amp;b=&quot;2" target="_blank" rel="noopener noreferrer">e</a>'
  );
  assert.equal(sanitize('<a href="/book">цаг</a> <a href="tel:99112233">утас</a>'), '<a href="/book">цаг</a> <a href="tel:99112233">утас</a>');
  assert.equal(sanitize('<a href="//evil.example">x</a>'), 'x');
  // Text stays text.
  assert.equal(sanitize('5 < 6 & "7" &lt;b&gt; &amp;'), '5 &lt; 6 &amp; &quot;7&quot; &lt;b&gt; &amp;');
  // Every tag is closed and stray closing tags cannot end the page's own elements.
  assert.equal(sanitize('<p>a <strong>b'), '<p>a <strong>b</strong></p>');
  assert.equal(sanitize('x</div></section></main><ul><li>y'), 'x<ul><li>y</li></ul>');
  assert.equal(sanitize('<p title="a>b">t</p>'), '<p>b&quot;&gt;t</p>');
  // Browser leftovers: lists wrapped in a div, empty paragraphs.
  assert.equal(sanitize('<p><br></p><p>a</p><div><ul><li>b</li></ul></div><p>&nbsp;</p>'), '<p>a</p><ul><li>b</li></ul>');

  assert.equal(toText('<h2>Гарчиг</h2><p>a&nbsp;&amp;&lt;b&gt;<br>c</p><ul><li>d</li></ul>'), 'Гарчиг a &<b> c d');
});

test('news posts: validation, newest first, drafts hidden from the site, update and delete', () => {
  assert.deepEqual(news.save(null, post({ title: ' ', body: '<p><br></p>', date: '2030-02-30' })).errors, [
    'Гарчиг оруулна уу.',
    'Мэдээний текст хоосон байна.',
    'Огноо буруу байна.',
  ]);
  assert.deepEqual(news.save(null, post({ body: '<script>alert(1)</script>' })).errors, ['Мэдээний текст хоосон байна.']);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM news').get().n, 0);

  const older = news.save(null, post({ title: 'Хуучин', date: '2030-01-01' })).id;
  const newer = news.save(null, post({ title: 'Шинэ', date: '2030-01-09', body: '<p>Сайн <b>байна</b> уу<script>x</script></p>' })).id;
  const draft = news.save(null, post({ title: 'Ноорог', date: '2030-01-20', published: false })).id;

  assert.deepEqual(news.list().map((n) => n.title), ['Шинэ', 'Хуучин']);
  assert.deepEqual(news.list({ all: true }).map((n) => n.title), ['Ноорог', 'Шинэ', 'Хуучин']);
  assert.equal(news.get(newer).body, '<p>Сайн <strong>байна</strong> уу</p>');
  assert.equal(news.get(draft), null);
  assert.equal(news.get(draft, { all: true }).title, 'Ноорог');
  assert.equal(news.get('abc'), null);

  // Publishing the draft and editing a post.
  assert.equal(news.save(draft, post({ title: 'Нийтэлсэн', date: '2030-01-20' })).id, draft);
  assert.equal(news.get(draft).title, 'Нийтэлсэн');
  assert.deepEqual(news.save(9999, post()).errors, ['Мэдээ олдсонгүй.']);

  const long = news.get(older);
  long.body = `<p>${'үг '.repeat(100)}</p>`;
  assert.ok(news.excerpt(long).endsWith('…'));
  assert.ok(news.excerpt(long).length <= 151);
  assert.equal(news.excerpt(news.get(newer)), 'Сайн байна уу');

  news.remove(older);
  assert.equal(news.get(older, { all: true }), null);
  db().exec('DELETE FROM news');
});

test('news pictures are stored, replaced, removed, and left alone by the home page editor', () => {
  assert.deepEqual(news.save(null, post({ image: { ...PICTURE, large: 'data:image/png;base64,AAAA' } })).errors, ['Зураг JPEG биш байна.']);
  assert.deepEqual(newsFiles(), []);

  const id = news.save(null, post({ image: PICTURE })).id;
  const first = news.get(id).image;
  assert.match(first.src, /^\/uploads\/news-[0-9a-f]{12}\.jpg$/);
  assert.equal(first.smallWidth, 400);
  assert.equal(newsFiles().length, 1); // large and small are the same test file

  // Saving without a new picture keeps it; the home page editor does not delete it.
  news.save(id, post({ title: 'Засварласан' }));
  assert.deepEqual(news.get(id).image, first);
  landing.setImage('hero', { large: JPEG, width: 800, height: 453 });
  landing.resetImage('hero');
  assert.equal(newsFiles().length, 1);

  // Removing the picture deletes the file; a second post's picture survives deleting the first post.
  news.save(id, post({ removeImage: true }));
  assert.equal(news.get(id).image, null);
  assert.deepEqual(newsFiles(), []);
  news.save(id, post({ image: PICTURE }));
  const other = news.save(null, post({ image: { ...PICTURE, small: undefined, smallWidth: undefined } })).id;
  news.remove(id);
  assert.equal(newsFiles().length, 1);
  assert.equal(news.get(other).image.small, undefined);
  news.remove(other);
  assert.deepEqual(newsFiles(), []);
});
