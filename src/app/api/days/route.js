import * as slots from '@/lib/slots.js';
import * as bookings from '@/lib/bookings.js';
import * as i18n from '@/i18n/index.js';
import { apiLimit, json } from '@/lib/api.js';

// Bookable days of a service, for the booking form.
export async function GET(request) {
  const limited = await apiLimit(request);
  if (limited) return limited;
  const service = bookings.getService(request.nextUrl.searchParams.get('service') || '');
  if (!service) return json({ error: 'service' }, 404);
  const days = slots.availableDays(service).map((d) => ({ ...d, ...i18n.dateParts(d.date) }));
  return json({ days });
}
