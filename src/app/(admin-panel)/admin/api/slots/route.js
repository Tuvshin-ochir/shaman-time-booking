import * as slots from '@/lib/slots.js';
import * as bookings from '@/lib/bookings.js';
import { isValidDate, fromMin } from '@/lib/time.js';
import { currentAdmin } from '@/lib/admin.js';
import { json } from '@/lib/api.js';

// Free start times for the admin forms (no lead-time / booking-window limits).
export async function GET(request) {
  if (!(await currentAdmin())) return new Response('Нэвтрэх шаардлагатай.', { status: 401 });
  const query = request.nextUrl.searchParams;
  const date = (query.get('date') || '').trim();
  if (!isValidDate(date)) return json({ error: 'date' }, 400);
  let duration;
  let dayOnly;
  let excludeId = 0;
  if (query.get('booking')) {
    const booking = bookings.getById(Number(query.get('booking')));
    if (!booking) return json({ error: 'booking' }, 404);
    duration = booking.end_min - booking.start_min;
    dayOnly = !!booking.day_only;
    excludeId = booking.id;
  } else {
    const service = bookings.getService((query.get('service') || '').trim(), { activeOnly: false });
    if (!service) return json({ error: 'service' }, 404);
    duration = service.duration_min;
    dayOnly = slots.isSpecial(service);
  }
  const closed = !slots.hoursFor(date);
  // Special services and their bookings take a whole day: there are no times to list.
  if (dayOnly) return json({ closed, dayOnly, times: [] });
  return json({
    closed,
    dayOnly,
    times: slots.availableTimes({ duration_min: duration }, date, { admin: true, excludeId }).map(fromMin),
  });
}
