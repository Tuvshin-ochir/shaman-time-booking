const settings = require('./settings');
const sms = require('./sms');
const { fromMin } = require('./time');
const { formatPhone, parsePhoneList } = require('./phone');

function vars(booking) {
  const business = settings.get('business');
  return {
    business: business.name,
    name: booking.customer_name,
    phone: formatPhone(booking.phone),
    date: booking.date.replace(/-/g, '.'),
    time: fromMin(booking.start_min),
    service: booking.service_name,
    address: business.address,
    contact: business.phone,
    code: booking.code,
  };
}

function render(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
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

module.exports = {
  render,
  vars,
  bookingConfirmed,
  bookingRescheduled: (booking) => toCustomer(booking, 'reschedule'),
  bookingCancelled: (booking) => toCustomer(booking, 'cancel'),
  reminder: (booking) => toCustomer(booking, 'reminder'),
};
