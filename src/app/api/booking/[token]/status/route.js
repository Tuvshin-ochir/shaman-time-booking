import * as bookings from '@/lib/bookings.js';
import { apiLimit, json } from '@/lib/api.js';

// Polled by the payment page.
export async function GET(request, { params }) {
  const limited = await apiLimit(request);
  if (limited) return limited;
  const { token } = await params;
  let booking = bookings.getByToken(token);
  if (!booking) return json({ error: 'not_found' }, 404);
  // Check even when the hold just ran out: the customer may have paid in the last seconds.
  if (booking.status === 'pending') {
    try {
      const force = request.nextUrl.searchParams.get('force');
      booking = await bookings.checkPayment(booking, { minIntervalMs: force ? 1000 : 3000 });
    } catch (err) {
      console.error(`[qpay] status check for booking ${booking.id} failed: ${err.message}`);
    }
  }
  return json({ status: bookings.effectiveStatus(booking), expiresAt: booking.hold_expires_at, now: Date.now() });
}
