import * as settings from './settings.js';
import * as sms from './sms.js';
import { fromMin } from './time.js';
import { formatPhone, parsePhoneList } from './phone.js';

function vars(booking) {
  const business = settings.get('business');
  return {
    business: business.name,
    name: booking.customer_name,
    phone: formatPhone(booking.phone),
    date: booking.date.replace(/-/g, '.'),
    // Day-only bookings (special services) have no time; render() drops {time}.
    time: booking.day_only ? '' : fromMin(booking.start_min),
    service: booking.service_name,
    address: business.address,
    contact: business.phone,
    code: booking.code,
  };
}

// An empty value takes the space before it and a case ending after it with it,
// so "{date} {time}-д" reads "2026.10.30" for a booking without a time.
function render(template, values) {
  return String(template || '').replace(/( ?)\{(\w+)\}(-[\p{L}]+)?/gu, (match, space, key, ending = '') => {
    if (!(key in values)) return match;
    const value = String(values[key] ?? '');
    return value ? `${space}${value}${ending}` : '';
  });
}

function toCustomer(booking, kind) {
  const template = settings.get('sms').templates[kind];
  return sms.send(booking.phone, render(template, vars(booking)), { bookingId: booking.id, kind });
}

async function bookingConfirmed(booking) {
  const cfg = settings.get('sms');
  const text = render(cfg.templates.staff_new, vars(booking));
  await Promise.all([
    toCustomer(booking, 'customer_confirm'),
    ...parsePhoneList(cfg.staff_phones).valid.map((phone) =>
      sms.send(phone, text, { bookingId: booking.id, kind: 'staff_new' })
    ),
  ]);
}

const bookingRescheduled = (booking) => toCustomer(booking, 'reschedule');
const bookingCancelled = (booking) => toCustomer(booking, 'cancel');
const reminder = (booking) => toCustomer(booking, 'reminder');

export { render, vars, bookingConfirmed, bookingRescheduled, bookingCancelled, reminder };
