import * as slots from '@/lib/slots.js';
import * as bookings from '@/lib/bookings.js';
import * as i18n from '@/i18n/index.js';
import { isValidDate, fromMin } from '@/lib/time.js';
import { apiLimit, json } from '@/lib/api.js';

// Free start times of a service on one day, for the booking form.
export async function GET(request) {
  const limited = await apiLimit(request);
  if (limited) return limited;
  const query = request.nextUrl.searchParams;
  const service = bookings.getService((query.get('service') || '').trim());
  const date = (query.get('date') || '').trim();
  if (!service) return json({ error: 'service' }, 404);
  if (!isValidDate(date)) return json({ error: 'date' }, 400);
  return json({ date, label: i18n.formatDate(date), times: slots.availableTimes(service, date).map(fromMin) });
}
