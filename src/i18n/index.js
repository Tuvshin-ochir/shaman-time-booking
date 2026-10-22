// Site texts. The site is Mongolian only; src/i18n/mn.js holds the default
// strings and the admin's home page editor can override any of them.
const settings = require('../lib/settings');
const { weekday } = require('../lib/time');

const TEXTS = require('./mn');

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

function formatPrice(amount) {
  return `${Number(amount || 0).toLocaleString('en-US')}₮`;
}

function middleware(req, res, next) {
  res.locals.t = translator(settings.get('landing').texts);
  res.locals.formatDate = formatDate;
  next();
}

const DAY_NAMES = TEXTS.days;

module.exports = { DAY_NAMES, translator, dateParts, formatDate, formatPrice, middleware };
