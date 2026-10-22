import * as bookings from '@/lib/bookings.js';

// QPay calls this after a payment. Its content is not trusted: we look the
// booking up by its secret token and ask QPay for the real payment status.
async function handle(request) {
  const booking = bookings.getByToken((request.nextUrl.searchParams.get('b') || '').trim());
  if (booking) {
    try {
      await bookings.checkPayment(booking, { minIntervalMs: 0, includeCancelled: true });
    } catch (err) {
      console.error(`[qpay] callback check for booking ${booking.id} failed: ${err.message}`);
    }
  }
  return new Response('SUCCESS', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export { handle as GET, handle as POST };
