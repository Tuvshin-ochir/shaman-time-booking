'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import * as bookings from '@/lib/bookings.js';
import { siteTranslator } from '@/i18n/index.js';
import { limiter, clientIp } from '@/lib/http.js';

const bookLimit = limiter('book', { windowMs: 15 * 60 * 1000, max: 10 });
const field = (value) => String(value ?? '').trim();

// Holds the chosen time and starts the QPay payment. Returns { error, code }
// when the booking cannot be made; otherwise redirects to the payment page
// (or straight to the booking page when nothing has to be paid online).
export async function submitBooking(formData) {
  const t = siteTranslator();
  if (!bookLimit(clientIp(await headers())).ok) return { error: t('err.rate'), code: 'rate' };
  if (!formData.get('agree')) return { error: t('err.agree'), code: 'agree' };
  // The customer has to choose: there is no default between in person and online.
  if (!formData.get('meeting')) return { error: t('err.meeting'), code: 'meeting' };

  let target;
  try {
    const booking = bookings.createHold({
      serviceId: field(formData.get('service_id')),
      date: field(formData.get('date')),
      time: field(formData.get('time')),
      name: field(formData.get('name')),
      phone: field(formData.get('phone')),
      note: field(formData.get('note')),
      meeting: field(formData.get('meeting')),
      ip: clientIp(await headers()),
    });
    const result = await bookings.startPayment(booking);
    target = `/${result.booking.status === 'confirmed' ? 'booking' : 'pay'}/${booking.token}`;
  } catch (err) {
    if (!(err instanceof bookings.BookingError)) throw err;
    return { error: t(`err.${err.code}`) || t('err.generic'), code: err.code };
  }
  redirect(target);
}
