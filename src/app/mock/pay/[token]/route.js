import { db } from '@/db.js';
import * as bookings from '@/lib/bookings.js';
import * as qpay from '@/lib/qpay.js';

// Development only: QPAY_MODE=mock lets you "pay" without QPay.
export async function POST(request, { params }) {
  const { token } = await params;
  const booking = qpay.isMock() ? bookings.getByToken(token) : null;
  if (!booking) return new Response('Not found', { status: 404 });
  const payment = db()
    .prepare(`SELECT * FROM payments WHERE booking_id = ? AND invoice_id IS NOT NULL ORDER BY id DESC LIMIT 1`)
    .get(booking.id);
  if (payment && qpay.mockPay(payment.invoice_id)) {
    await bookings.checkPayment(booking, { minIntervalMs: 0 });
  }
  return new Response(null, { status: 303, headers: { Location: `/booking/${booking.token}` } });
}
