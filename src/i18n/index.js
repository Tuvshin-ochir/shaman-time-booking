// Site texts. The site is Mongolian only; src/i18n/mn.js holds the default
// strings and the admin's home page editor can override any of them.
import * as settings from '../lib/settings.js';
import { weekday, fromMin } from '../lib/time.js';

import TEXTS from './mn.js';

// `overrides` ({ key: { mn } }) are the admin's edits from the home page editor.
function translator(overrides = {}) {
  return (key, vars) => {
    const edited = overrides[key] && overrides[key].mn;
    let text = edited || (TEXTS[key] ?? key);
    if (vars) text = text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
    return text;
  };
}

function dateParts(date) {
  const [, month, day] = date.split('-').map(Number);
  const wd = weekday(date);
  return { weekday: TEXTS.days[wd], weekdayShort: TEXTS.days_short[wd], day, month: `${month}-р сар` };
}

// "10-р сарын 24, Баасан"
function formatDate(date) {
  const p = dateParts(date);
  const month = Number(date.split('-')[1]);
  return `${month}-р сарын ${p.day}, ${p.weekday}`;
}

// "10-р сарын 24, Баасан, 14:00" (with `end`: "14:00–15:00"); a day-only
// booking (special service) has just the date.
function formatWhen(booking, { end = false } = {}) {
  const date = formatDate(booking.date);
  if (booking.day_only) return date;
  return `${date}, ${fromMin(booking.start_min)}${end ? `–${fromMin(booking.end_min)}` : ''}`;
}

function formatPrice(amount) {
  return `${Number(amount || 0).toLocaleString('en-US')}₮`;
}

// Translator with the admin's edits applied, for site pages.
function siteTranslator() {
  return translator(settings.get('landing').texts);
}

const DAY_NAMES = TEXTS.days;

export { TEXTS, DAY_NAMES, translator, siteTranslator, dateParts, formatDate, formatWhen, formatPrice };
