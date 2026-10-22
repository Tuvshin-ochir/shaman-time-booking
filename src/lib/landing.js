// Everything on the home page the admin can edit: UI strings, long-form
// content, images and the gallery. Admin form: views/admin/landing.ejs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config from '../config.js';
import * as settings from './settings.js';

// store: 'text'     -> settings.landing.texts[key] overrides the string `key` in src/i18n/mn.js
//        'content'  -> settings.content[`${key}_mn`]
//        'business' -> settings.business[key]
// kind:  line | multiline | lines (one item per line) | faq (blank-line separated blocks)
const SECTIONS = [
  {
    id: 'hero',
    title: 'Нүүр хэсэг (hero)',
    images: ['hero'],
    fields: [
      { store: 'business', key: 'name', label: 'Гарчиг (байгууллагын нэр)', required: true },
      { store: 'business', key: 'tagline', label: 'Уриа', kind: 'multiline', hint: 'Facebook-д линк хуваалцахад гарах тайлбар ч болно.' },
      { store: 'text', key: 'home.eyebrow', label: 'Гарчгийн дээрх жижиг шошго' },
      { store: 'text', key: 'home.hero_btn_primary', label: 'Үндсэн товч' },
      { store: 'text', key: 'home.hero_btn_secondary', label: 'Хоёрдугаар товч' },
      { store: 'text', key: 'home.trust_online', label: 'Давуу тал 1' },
      { store: 'text', key: 'home.trust_qpay', label: 'Давуу тал 2' },
      { store: 'text', key: 'home.trust_sms', label: 'Давуу тал 3' },
      { store: 'text', key: 'home.next_free', label: 'Сул цагийн картын гарчиг' },
      { store: 'text', key: 'home.next_more', label: 'Бусад сул цагийн шошго' },
      { store: 'text', key: 'home.next_take', label: 'Сул цагийн картын товч' },
    ],
  },
  {
    id: 'intro',
    title: 'Танилцуулга',
    images: ['intro'],
    fields: [
      { store: 'text', key: 'home.intro_eyebrow', label: 'Жижиг шошго' },
      { store: 'content', key: 'home_title', label: 'Гарчиг' },
      { store: 'content', key: 'home_intro', label: 'Текст', kind: 'multiline', hint: 'Догол мөр тусгаарлахдаа хоосон мөр үлдээнэ.' },
      { store: 'content', key: 'highlights', label: 'Онцлогууд', kind: 'lines', hint: 'Мөр бүрт нэг.' },
      { store: 'text', key: 'home.intro_link', label: 'Холбоосын текст' },
    ],
  },
  {
    id: 'prepare',
    title: 'Ирэхээсээ өмнө',
    images: ['prepare'],
    fields: [
      { store: 'text', key: 'home.prepare_title', label: 'Гарчиг' },
      { store: 'text', key: 'home.prepare_sub', label: 'Тайлбар' },
      { store: 'content', key: 'prepare', label: 'Зөвлөмжүүд', kind: 'lines', hint: 'Мөр бүрт нэг. Хоосон бол энэ хэсэг харагдахгүй.' },
    ],
  },
  {
    id: 'news',
    title: 'Мэдээ мэдээлэл',
    note: { text: 'Мэдээг «Мэдээ» цэснээс нэмж, засна. Нийтэлсэн мэдээгүй бол энэ хэсэг харагдахгүй.', href: '/admin/news' },
    fields: [
      { store: 'text', key: 'home.news_title', label: 'Гарчиг' },
      { store: 'text', key: 'home.news_all', label: 'Холбоосын текст' },
    ],
  },
  {
    id: 'gallery',
    title: 'Зургийн цомог',
    gallery: true,
    fields: [{ store: 'text', key: 'home.gallery_title', label: 'Гарчиг' }],
  },
  {
    id: 'faq',
    title: 'Түгээмэл асуулт',
    fields: [
      { store: 'text', key: 'home.faq_title', label: 'Гарчиг' },
      {
        store: 'content',
        key: 'faq',
        label: 'Асуулт, хариулт',
        kind: 'faq',
        hint: 'Эхний мөрөнд асуулт, дараагийн мөрөнд хариулт. Асуулт хооронд хоосон мөр үлдээнэ.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Хаяг, ажлын цаг',
    note: { text: 'Хаяг, утсыг «Тохиргоо»-оос, ажлын цагийг «Хуваарь»-аас засна.', href: '/admin/settings#business' },
    fields: [
      { store: 'text', key: 'home.contact_title', label: 'Гарчиг' },
      { store: 'text', key: 'home.hours_title', label: 'Ажлын цагийн гарчиг' },
    ],
  },
  {
    id: 'cta',
    title: 'Төгсгөлийн уриалга',
    images: ['cta'],
    fields: [
      { store: 'text', key: 'home.cta_title', label: 'Гарчиг' },
      { store: 'text', key: 'home.cta_text', label: 'Текст', kind: 'multiline' },
      { store: 'text', key: 'home.cta_btn', label: 'Товч' },
    ],
  },
  {
    id: 'chrome',
    title: 'Цэс ба хөл хэсэг',
    fields: [
      { store: 'text', key: 'nav.home', label: 'Цэс: Нүүр' },
      { store: 'text', key: 'nav.services', label: 'Цэс: Үйлчилгээ' },
      { store: 'text', key: 'nav.about', label: 'Цэс: Бидний тухай' },
      { store: 'text', key: 'nav.contact', label: 'Цэс: Холбоо барих' },
      { store: 'text', key: 'cta.book', label: '«Цаг захиалах» товч (бүх хуудсанд)' },
      { store: 'text', key: 'footer.secure', label: 'Хөл хэсгийн төлбөрийн тайлбар' },
    ],
  },
  {
    id: 'share',
    title: 'Бусад зураг',
    images: ['about', 'og'],
    fields: [],
  },
  // Rendered by views/admin/landing.ejs from src/lib/policy.js.
  {
    id: 'policy',
    title: 'Цуцлах, буцаалтын нөхцөл',
    policy: true,
    fields: [],
  },
];

const IMAGE_SLOTS = {
  hero: {
    label: 'Нүүр зураг',
    hint: 'Хэвтээ, өргөн зураг. Дээр нь цагаан текст байрлах тул хэт цайвар биш зураг сайн.',
    large: 1600,
    small: 800,
    def: { src: '/img/photos/hero-1600.jpg', width: 1600, height: 1067, small: '/img/photos/hero-800.jpg', smallWidth: 800 },
  },
  intro: {
    label: 'Танилцуулгын зураг',
    hint: 'Босоо (4:5 орчим) зураг тохиромжтой.',
    large: 1000,
    small: 600,
    def: { src: '/img/photos/about-1000.jpg', width: 1000, height: 1250, small: '/img/photos/about-600.jpg', smallWidth: 600 },
  },
  prepare: {
    label: '«Ирэхээсээ өмнө» хэсгийн зураг',
    hint: 'Хэвтээ зураг.',
    large: 1200,
    small: 600,
    def: { src: '/img/photos/uvurkhangai-800.jpg', width: 800, height: 600 },
  },
  cta: {
    label: 'Төгсгөлийн хэсгийн дэвсгэр',
    hint: 'Бараан зураг дээр цагаан текст сайн харагдана.',
    large: 1600,
    small: 800,
    def: { src: '/img/photos/night-1600.jpg', width: 1600, height: 909, small: '/img/photos/night-800.jpg', smallWidth: 800 },
  },
  about: {
    label: '«Бидний тухай» хуудасны зураг',
    hint: 'Хэвтээ зураг.',
    large: 1200,
    small: 600,
    def: { src: '/img/photos/tsambagarav-800.jpg', width: 800, height: 533 },
  },
  og: {
    label: 'Facebook-д хуваалцах зураг',
    hint: '1200×630 хэмжээгээр голоос нь тайрна. Солисны дараа Facebook Sharing Debugger-ээр шинэчилнэ.',
    large: 1200,
    crop: 1200 / 630,
    def: { src: '/img/og.jpg', width: 1200, height: 630 },
  },
};

const GALLERY_SIZES = { large: 1200, small: 600 };
const GALLERY_MAX = 12;

const DEFAULT_GALLERY = [
  { src: '/img/photos/tsambagarav-800.jpg', width: 800, height: 533, caption_mn: 'Цамбагарав уул' },
  { src: '/img/photos/gobi-800.jpg', width: 800, height: 640, caption_mn: 'Хонгорын элс' },
  { src: '/img/photos/khuvsgul-800.jpg', width: 800, height: 453, caption_mn: 'Хөвсгөл нуур' },
  { src: '/img/photos/altai-snow-800.jpg', width: 800, height: 450, caption_mn: 'Алтайн нуруу' },
  { src: '/img/photos/altai-rocky-800.jpg', width: 800, height: 450, caption_mn: 'Алтайн хадат уулс' },
];

class LandingError extends Error {}

const uploadDir = () => path.join(config.dataDir, 'uploads');

// ── Reading ───────────────────────────────────────────────

function image(slot) {
  return settings.get('landing').images[slot] || IMAGE_SLOTS[slot].def;
}

function isCustomImage(slot) {
  return !!settings.get('landing').images[slot];
}

function gallery() {
  const stored = settings.get('landing').gallery;
  return Array.isArray(stored) ? stored : DEFAULT_GALLERY;
}

function srcset(img) {
  return img.small && img.smallWidth ? `${img.small} ${img.smallWidth}w, ${img.src} ${img.width}w` : '';
}

// Current value of a field for the admin form. `defaults` is the translator
// without the admin's overrides.
function fieldValue(field, defaults) {
  if (field.store === 'text') {
    const override = settings.get('landing').texts[field.key];
    return (override && override.mn) || defaults(field.key);
  }
  const source = settings.get(field.store);
  return field.store === 'business' ? source[field.key] : source[`${field.key}_mn`];
}

// ── Saving texts ──────────────────────────────────────────

const clean = (value, kind) => {
  const text = String(Array.isArray(value) ? value[0] : (value ?? '')).replace(/\r\n/g, '\n');
  return (kind === 'line' || !kind ? text.replace(/\s+/g, ' ') : text).trim().slice(0, kind === 'faq' ? 10000 : 2000);
};

// body keys look like "text:home.eyebrow", "content:home_intro", "caption:0".
function saveTexts(body, defaults) {
  const landing = structuredClone(settings.get('landing'));
  const content = { ...settings.get('content') };
  const business = { ...settings.get('business') };

  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const name = `${field.store}:${field.key}`;
      if (!(name in body)) continue;
      const value = clean(body[name], field.kind);
      if (field.store === 'text') {
        if (value && value !== defaults(field.key)) landing.texts[field.key] = { mn: value };
        else delete landing.texts[field.key];
      } else if (field.store === 'content') {
        content[`${field.key}_mn`] = value;
      } else if (field.store === 'business') {
        if (field.required && !value) throw new LandingError(`«${field.label}» хоосон байж болохгүй.`);
        business[field.key] = value;
      }
    }
  }

  const items = gallery().map((item, i) => ({
    ...item,
    caption_mn: `caption:${i}` in body ? clean(body[`caption:${i}`]).slice(0, 100) : item.caption_mn,
  }));
  if (JSON.stringify(items) !== JSON.stringify(gallery())) landing.gallery = items;

  settings.set('landing', landing);
  settings.set('content', content);
  settings.set('business', business);
}

// ── Images ────────────────────────────────────────────────

// The browser resizes and re-encodes images before upload (public/assets/js/admin.js),
// so the server only has to accept modest JPEGs.
function writeJpeg(dataUrl, prefix) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new LandingError('Зураг JPEG биш байна.');
  const buf = Buffer.from(match[1], 'base64');
  if (buf.length < 200 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new LandingError('Зургийн файл гэмтэлтэй байна.');
  if (buf.length > 4 * 1024 * 1024) throw new LandingError('Зураг хэт том байна (4 MB-аас бага).');
  const name = `${prefix}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)}.jpg`;
  fs.mkdirSync(uploadDir(), { recursive: true });
  fs.writeFileSync(path.join(uploadDir(), name), buf);
  return `/uploads/${name}`;
}

function dimension(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 50 || n > 4000) throw new LandingError('Зургийн хэмжээ буруу.');
  return n;
}

function storeUpload(prefix, payload) {
  const img = { src: writeJpeg(payload.large, prefix), width: dimension(payload.width), height: dimension(payload.height) };
  if (payload.small) {
    img.small = writeJpeg(payload.small, prefix);
    img.smallWidth = dimension(payload.smallWidth);
  }
  return img;
}

// Removes uploaded files that no setting points to any more.
function removeOrphans() {
  const landing = settings.get('landing');
  const used = new Set();
  for (const img of [...Object.values(landing.images), ...(landing.gallery || [])]) {
    for (const url of [img.src, img.small]) if (url && url.startsWith('/uploads/')) used.add(path.basename(url));
  }
  let files = [];
  try {
    files = fs.readdirSync(uploadDir());
  } catch {
    return;
  }
  // News pictures (news-*.jpg) are looked after by src/lib/news.js.
  for (const file of files) {
    if (file.endsWith('.jpg') && !file.startsWith('news-') && !used.has(file)) fs.rmSync(path.join(uploadDir(), file), { force: true });
  }
}

function updateLanding(mutate) {
  const landing = structuredClone(settings.get('landing'));
  mutate(landing);
  settings.set('landing', landing);
  removeOrphans();
}

function setImage(slot, payload) {
  if (!IMAGE_SLOTS[slot]) throw new LandingError('Зургийн байршил буруу.');
  const img = storeUpload(slot, payload);
  updateLanding((landing) => {
    landing.images[slot] = img;
  });
}

function resetImage(slot) {
  if (!IMAGE_SLOTS[slot]) throw new LandingError('Зургийн байршил буруу.');
  updateLanding((landing) => {
    delete landing.images[slot];
  });
}

function galleryIndex(items, index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= items.length) throw new LandingError('Зураг олдсонгүй.');
  return i;
}

function setGalleryImage(index, payload) {
  const items = structuredClone(gallery());
  const img = storeUpload('gallery', payload);
  if (index === undefined || index === null || index === '') {
    if (items.length >= GALLERY_MAX) throw new LandingError(`Цомогт хамгийн ихдээ ${GALLERY_MAX} зураг байна.`);
    items.push({ ...img, caption_mn: '' });
  } else {
    const i = galleryIndex(items, index);
    items[i] = { ...img, caption_mn: items[i].caption_mn };
  }
  updateLanding((landing) => {
    landing.gallery = items;
  });
}

function deleteGalleryImage(index) {
  const items = structuredClone(gallery());
  items.splice(galleryIndex(items, index), 1);
  updateLanding((landing) => {
    landing.gallery = items;
  });
}

function moveGalleryImage(index, direction) {
  const items = structuredClone(gallery());
  const i = galleryIndex(items, index);
  const j = i + (direction === 'up' ? -1 : 1);
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  updateLanding((landing) => {
    landing.gallery = items;
  });
}

function resetGallery() {
  updateLanding((landing) => {
    landing.gallery = null;
  });
}

export {  SECTIONS,
  IMAGE_SLOTS,
  GALLERY_SIZES,
  GALLERY_MAX,
  LandingError,
  uploadDir,
  storeUpload,
  image,
  isCustomImage,
  gallery,
  srcset,
  fieldValue,
  saveTexts,
  setImage,
  resetImage,
  setGalleryImage,
  deleteGalleryImage,
  moveGalleryImage,
  resetGallery,
};
