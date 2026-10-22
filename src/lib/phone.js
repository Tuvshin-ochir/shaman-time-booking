// Mongolian mobile numbers are 8 digits starting with 5, 6, 8 or 9 (7x numbers
// are landlines and can't receive SMS). Accepts "+976 9911-2233" style input.
// If an operator opens a new prefix, extend this pattern.
const MOBILE_RE = /^[5689]\d{7}$/;

function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+976')) digits = digits.slice(4);
  else if (digits.startsWith('976') && digits.length === 11) digits = digits.slice(3);
  return MOBILE_RE.test(digits) ? digits : null;
}

function formatPhone(phone) {
  return phone && phone.length === 8 ? `${phone.slice(0, 4)}-${phone.slice(4)}` : phone || '';
}

// Splits a comma/space separated list (used for staff numbers in settings).
function parsePhoneList(text) {
  const valid = [];
  const invalid = [];
  for (const part of String(text || '').split(/[,;\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const phone = normalizePhone(trimmed);
    if (phone) valid.push(phone);
    else invalid.push(trimmed);
  }
  return { valid: [...new Set(valid)], invalid };
}

module.exports = { normalizePhone, formatPhone, parsePhoneList };
