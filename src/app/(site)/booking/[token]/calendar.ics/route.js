import config from '@/config.js';
import * as settings from '@/lib/settings.js';
import * as bookings from '@/lib/bookings.js';
import { localToEpoch, addDays } from '@/lib/time.js';

function icsText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsTime(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const icsDate = (date) => date.replace(/-/g, '');

export async function GET(request, { params }) {
  const { token } = await params;
  const booking = bookings.getByToken(token);
  if (!booking || booking.status !== 'confirmed') return new Response('Not found', { status: 404 });
  const business = settings.get('business');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//time-booking//MN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.code}@${new URL(config.baseUrl).hostname}`,
    `DTSTAMP:${icsTime(Date.now())}`,
    // A day-only booking (special service) is an all-day event.
    ...(booking.day_only
      ? [`DTSTART;VALUE=DATE:${icsDate(booking.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(booking.date, 1))}`]
      : [
          `DTSTART:${icsTime(localToEpoch(booking.date, booking.start_min))}`,
          `DTEND:${icsTime(localToEpoch(booking.date, booking.end_min))}`,
        ]),
    `SUMMARY:${icsText(`${booking.service_name} — ${business.name}`)}`,
    `LOCATION:${icsText(booking.meeting === 'online' ? 'Онлайн' : business.address)}`,
    `DESCRIPTION:${icsText(`${booking.code} · ${business.phone}`)}`,
    'BEGIN:VALARM',
    booking.day_only ? 'TRIGGER:-PT15H' : 'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(booking.service_name)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking-${booking.code}.ics"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
