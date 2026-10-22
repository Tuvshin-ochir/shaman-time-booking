// Cancellation & refund policy page: intro, coloured key-rule cards and
// numbered detail sections. Edited in the admin home page editor.
import * as settings from './settings.js';
import { nowLocal } from './time.js';

const TONES = [
  ['good', 'Ногоон — боломжтой'],
  ['warn', 'Шар — анхаарах'],
  ['bad', 'Улаан — болохгүй'],
];
const MAX_HIGHLIGHTS = 6;
const MAX_SECTIONS = 20;

const DEFAULT_HIGHLIGHTS = [
  {
    tone: 'good',
    title_mn: '24 цагаас өмнө',
    text_mn: 'Цуцлах эсвэл цаг шилжүүлбэл төлсөн төлбөрийг бүрэн буцаана.',
  },
  {
    tone: 'warn',
    title_mn: '24 цагаас бага хугацаанд',
    text_mn: 'Цуцалбал төлсөн төлбөр буцаагдахгүй.',
  },
  {
    tone: 'bad',
    title_mn: '15 минутаас илүү хоцорвол',
    text_mn: 'Захиалга цуцлагдсанд тооцогдоно.',
  },
];

const DEFAULT_SECTIONS = [
  {
    title_mn: 'Захиалга цуцлах',
    body_mn: 'Цуцлах бол захиалгын код болон утасны дугаараа хэлж бидэн рүү залгана уу. Захиалгын код таны утсанд ирсэн SMS-д байгаа.',
  },
  {
    title_mn: 'Цаг шилжүүлэх',
    body_mn: 'Захиалгын цагаас 24 цагаас өмнө мэдэгдвэл сул байгаа өөр цаг руу шилжүүлнэ. Шинэ цаг баталгаажмагц таны утсанд SMS очно.',
  },
  {
    title_mn: 'Хоцрох, ирэхгүй байх',
    body_mn: 'Товлосон цагаасаа 15 минутаас илүү хоцорвол захиалга цуцлагдсанд тооцогдоно. Боломжтой бол дараагийн сул цаг руу шилжүүлнэ.\n\nМэдэгдэлгүйгээр ирээгүй тохиолдолд төлбөр буцаагдахгүй.',
  },
  {
    title_mn: 'Төлбөр буцаах',
    body_mn: 'Буцаалтыг ажлын 3 хоногийн дотор төлбөр төлсөн данс руу шилжүүлнэ. Урьдчилгаа төлбөртэй үйлчилгээний хувьд төлсөн урьдчилгааг буцаана.',
  },
  {
    title_mn: 'Бидний зүгээс цуцлах',
    body_mn: 'Давагдашгүй шалтгаанаар бид цагийг цуцлах шаардлагатай болвол тантай урьдчилан холбогдож, өөр цаг санал болгох эсвэл төлбөрийг бүрэн буцаана.',
  },
];

function get() {
  const stored = settings.get('policy');
  return {
    ...stored,
    highlights: Array.isArray(stored.highlights) ? stored.highlights : DEFAULT_HIGHLIGHTS,
    sections: Array.isArray(stored.sections) ? stored.sections : DEFAULT_SECTIONS,
  };
}

function clean(value, multiline) {
  const text = String(Array.isArray(value) ? value[0] : (value ?? '')).replace(/\r\n/g, '\n');
  return (multiline ? text : text.replace(/\s+/g, ' ')).trim().slice(0, multiline ? 4000 : 300);
}

// Rows are posted as "<kind>:<row id>:<field>". Row ids are arbitrary; the
// order of the fields in the body (= order on screen) decides the row order.
function collect(body, kind) {
  const rows = new Map();
  for (const [name, value] of Object.entries(body)) {
    const match = /^(highlight|section):([\w-]+):(tone|title|text|body)$/.exec(name);
    if (!match || match[1] !== kind) continue;
    const [, , id, field] = match;
    if (!rows.has(id)) rows.set(id, {});
    rows.get(id)[field === 'tone' ? field : `${field}_mn`] = clean(value, field === 'body');
  }
  return [...rows.values()];
}

// Only the fields the page shows, so rows stored by older versions (which
// also had English texts) compare equal to what the form posts back.
const highlightRow = (h) => ({ tone: h.tone, title_mn: h.title_mn || '', text_mn: h.text_mn || '' });
const sectionRow = (s) => ({ title_mn: s.title_mn || '', body_mn: s.body_mn || '' });

// Saves the policy part of the home page editor form. The date only moves
// when something actually changed.
function save(body) {
  if (!('policy:intro' in body)) return;
  const tones = TONES.map(([value]) => value);
  const next = {
    intro_mn: clean(body['policy:intro'], true),
    highlights: collect(body, 'highlight')
      .map((h) => highlightRow({ ...h, tone: tones.includes(h.tone) ? h.tone : 'good' }))
      .filter((h) => h.title_mn || h.text_mn)
      .slice(0, MAX_HIGHLIGHTS),
    sections: collect(body, 'section')
      .map(sectionRow)
      .filter((s) => s.title_mn || s.body_mn)
      .slice(0, MAX_SECTIONS),
  };
  const current = get();
  const unchanged =
    next.intro_mn === current.intro_mn &&
    JSON.stringify(next.highlights) === JSON.stringify(current.highlights.map(highlightRow)) &&
    JSON.stringify(next.sections) === JSON.stringify(current.sections.map(sectionRow));
  if (unchanged) return;
  settings.set('policy', { ...next, updated_at: nowLocal().date });
}

export { TONES, MAX_HIGHLIGHTS, MAX_SECTIONS, get, save };
