import { db } from '../db.js';
import { shared } from './shared.js';

const DEFAULTS = {
  business: {
    name: 'Бөөгийн үзлэг',
    tagline: 'Үзлэг, засал, мялаалгад цагаа онлайнаар захиалж, дараалалгүй үйлчлүүлээрэй.',
    phone: '9900-0000',
    email: 'info@example.mn',
    address: 'Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо, (хаягаа админ самбараас оруулна уу)',
    map_url: '',
    facebook_url: '',
  },
  schedule: {
    // Index = weekday, 0 = Sunday.
    weekly: [
      { open: false, start: '10:00', end: '15:00', break_start: '', break_end: '' },
      { open: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      { open: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      { open: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      { open: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      { open: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      { open: true, start: '10:00', end: '15:00', break_start: '', break_end: '' },
    ],
    slot_minutes: 30, // spacing between offered start times
    lead_minutes: 60, // earliest bookable time = now + lead
    window_days: 30, // how far ahead customers can book
    hold_minutes: 15, // unpaid holds are released after this
    capacity: 1, // bookings allowed at the same time
  },
  sms: {
    staff_phones: '',
    reminders: true,
    transliterate: true,
    // Placeholders: {business} {name} {phone} {date} {time} {mode} {service} {address} {contact} {code}
    templates: {
      customer_confirm:
        '{business}: Захиалга баталгаажлаа. Цаг: {date} {time}, {mode}. Нэр: {name}, утас: {phone}. Хаяг: {address}. Лавлах: {contact}',
      staff_new: 'Шинэ захиалга: {date} {time}, {mode}. Нэр: {name}, утас: {phone}. {service}',
      reminder: '{business}: Сануулга - маргааш {date} {time}-д таны цаг ({mode}). Хаяг: {address}. Утас: {contact}',
      reschedule: '{business}: Таны цаг {date} {time} болж өөрчлөгдлөө. Код: {code}. Утас: {contact}',
      cancel: '{business}: Таны {date} {time}-ийн захиалга цуцлагдлаа. Лавлах: {contact}',
    },
  },
  // Home page sections. "highlights" and "prepare" take one item per line;
  // "faq" takes blocks separated by a blank line: first line question, rest answer.
  content: {
    home_title_mn: 'Уламжлалт бөөгийн үзлэг, засал',
    home_intro_mn:
      'Монгол бөө мөргөлийн уламжлалт ёс заншлын дагуу үзлэг, засал, мялаалга хийж байна. Таны асуудлыг анхааралтай сонсож, тайван, нууцлалтай орчинд үйлчилнэ.\n\nЦагаа урьдчилан онлайнаар захиалснаар дараалалд зогсохгүй, яг товлосон цагтаа ирж үйлчлүүлнэ.',
    highlights_mn: 'Уламжлалт ёс заншил\nТайван, нууцлалтай орчин\nДараалалгүй, товлосон цагтаа',
    prepare_mn:
      'Товлосон цагаасаа 10 минутын өмнө ирнэ үү.\nҮзүүлэх хүний нэр, төрсөн он, жилийг бэлдэж ирнэ үү.\nХадаг, өргөл авчрах эсэхийг урьдчилан утсаар лавлана уу.\nСогтууруулах ундаа хэрэглэсэн үедээ ирэхгүй байхыг хүсье.\nЦаг өөрчлөх, цуцлах бол 24 цагийн өмнө мэдэгдэнэ үү.',
    faq_mn:
      'Төлбөрөө хэрхэн төлөх вэ?\nЦаг захиалахдаа QPay-ээр ямар ч банкны аппаар төлнө. Урьдчилгаатай үйлчилгээний үлдэгдлийг газар дээр нь төлнө.\n\nЗахиалга баталгаажсаныг яаж мэдэх вэ?\nТөлбөр төлөгдмөгц таны утсанд өдөр, цаг, хаягийн мэдээлэлтэй SMS очно. Мөн цагаас 1 өдрийн өмнө сануулга ирнэ.\n\nЦагаа өөрчилж болох уу?\nБолно. Захиалгын цагаас 24 цагийн өмнө утсаар холбогдоно уу.\n\nӨөр хүнд зориулж цаг захиалж болох уу?\nБолно. Үзүүлэх хүний нэрийг бичиж, нэмэлт мэдээллээ тайлбар хэсэгт үлдээнэ үү.\n\nХаана байрладаг вэ?\nХаяг болон газрын зургийн холбоосыг «Холбоо барих» хэсгээс харна уу.',
    about_mn:
      'Бөө мөргөл бол хүн, байгаль, тэнгэрийн эв нэгдлийг эрхэмлэдэг Монголчуудын эртний уламжлалт шүтлэг юм.\n\n[Энд бөөгийн танилцуулга, удам угсаа, туршлагаа бичнэ үү. Админ самбар → Тохиргоо → Сайтын текст.]',
  },
  // Cancellation & refund policy page (see src/lib/policy.js). null lists = defaults.
  policy: {
    updated_at: null,
    intro_mn:
      'Бид таны цагийг зөвхөн танд зориулж барьдаг тул тэр цагт өөр хүнээс захиалга авдаггүй. Иймд цуцлах, цаг шилжүүлэх бол аль болох эрт мэдэгдэхийг хүсье.',
    highlights: null,
    sections: null,
  },
  // Admin edits of the home page (see src/lib/landing.js). Empty = use the defaults.
  landing: {
    texts: {}, // text key (src/i18n/mn.js) -> { mn }
    images: {}, // slot -> { src, width, height, small, smallWidth }
    gallery: null, // null = default gallery
  },
};

const cache = shared('settingsCache', () => new Map());

// Earlier default SMS texts. Saving the SMS settings stores every text, so a
// stored text that still equals an old default was never edited and follows
// the current default instead.
const OLD_SMS_TEMPLATES = {
  customer_confirm: [
    '{business}: Захиалга баталгаажлаа. Цаг: {date} {time}. Нэр: {name}, утас: {phone}. Хаяг: {address}. Лавлах: {contact}',
  ],
  staff_new: ['Шинэ захиалга: {date} {time}. Нэр: {name}, утас: {phone}. {service}'],
  reminder: ['{business}: Сануулга - маргааш {date} {time}-д таны цаг. Хаяг: {address}. Утас: {contact}'],
};

function upgradeSmsTemplates(sms) {
  for (const [key, old] of Object.entries(OLD_SMS_TEMPLATES)) {
    if (old.includes(sms.templates[key])) sms.templates[key] = DEFAULTS.sms.templates[key];
  }
  return sms;
}

function merge(defaults, stored) {
  if (Array.isArray(defaults)) {
    return defaults.map((d, i) => (stored && stored[i] !== undefined ? merge(d, stored[i]) : d));
  }
  if (defaults && typeof defaults === 'object') {
    // Keep stored keys that have no default (e.g. landing.texts / landing.images maps).
    const out = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
    for (const key of Object.keys(defaults)) {
      out[key] = stored && stored[key] !== undefined ? merge(defaults[key], stored[key]) : defaults[key];
    }
    return out;
  }
  return stored === undefined ? defaults : stored;
}

function get(section) {
  if (!DEFAULTS[section]) throw new Error(`Unknown settings section: ${section}`);
  if (cache.has(section)) return cache.get(section);
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(section);
  let value = merge(DEFAULTS[section], row ? JSON.parse(row.value) : undefined);
  if (section === 'sms') value = upgradeSmsTemplates(value);
  cache.set(section, value);
  return value;
}

function set(section, value) {
  if (!DEFAULTS[section]) throw new Error(`Unknown settings section: ${section}`);
  db()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(section, JSON.stringify(value));
  cache.delete(section);
}

function clearCache() {
  cache.clear();
}

export { get, set, clearCache, DEFAULTS };
