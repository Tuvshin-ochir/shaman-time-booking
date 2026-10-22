'use server';

import * as bookings from '@/lib/bookings.js';
import * as notify from '@/lib/notify.js';
import { ERRORS } from '@/lib/admin-messages.js';
import { requireAdmin, field, checked, done } from '@/lib/admin.js';

export async function createBooking(formData) {
  const admin = await requireAdmin();
  let booking;
  try {
    booking = bookings.createManual({
      serviceId: field(formData.get('service_id')),
      date: field(formData.get('date')),
      time: field(formData.get('time')),
      name: field(formData.get('name')),
      phone: field(formData.get('phone')),
      note: field(formData.get('note')),
      meeting: field(formData.get('meeting')) || 'in_person',
      paidAmount: field(formData.get('paid_amount')),
      force: checked(formData.get('force')),
      actor: admin.username,
    });
    if (checked(formData.get('notify'))) await notify.bookingConfirmed(booking);
  } catch (err) {
    if (!(err instanceof bookings.BookingError)) throw err;
    return { error: ERRORS[err.code] || err.message };
  }
  done(`/admin/bookings/${booking.id}?ok=created`);
}

// Runs a booking action and goes back to the booking with ?ok=<result> or ?err=<code>.
async function bookingAction(id, handler) {
  const admin = await requireAdmin();
  let ok;
  try {
    ok = await handler(admin);
  } catch (err) {
    if (!(err instanceof bookings.BookingError)) throw err;
    done(`/admin/bookings/${id}?err=${encodeURIComponent(err.code)}`);
  }
  done(`/admin/bookings/${id}?ok=${ok}`);
}

export async function cancelBooking(id, formData) {
  await bookingAction(id, async (admin) => {
    const booking = await bookings.cancel(id, {
      reason: field(formData.get('reason')),
      refund: checked(formData.get('refund')),
      actor: admin.username,
    });
    if (checked(formData.get('notify'))) await notify.bookingCancelled(booking);
    return 'cancelled';
  });
}

export async function rescheduleBooking(id, formData) {
  await bookingAction(id, async (admin) => {
    const booking = bookings.reschedule(id, {
      date: field(formData.get('date')),
      time: field(formData.get('time')),
      force: checked(formData.get('force')),
      actor: admin.username,
    });
    if (checked(formData.get('notify')) && booking.status === 'confirmed') await notify.bookingRescheduled(booking);
    return 'rescheduled';
  });
}

export async function markRefunded(id) {
  await bookingAction(id, async (admin) => {
    bookings.markRefunded(id, { actor: admin.username });
    return 'refunded';
  });
}

export async function recordPayment(id, formData) {
  await bookingAction(id, async (admin) => {
    bookings.recordManualPayment(id, { amount: field(formData.get('amount')), note: field(formData.get('note')), actor: admin.username });
    return 'payment';
  });
}

export async function saveNote(id, formData) {
  await bookingAction(id, async (admin) => {
    if (!bookings.getById(id)) throw new bookings.BookingError('not_found');
    bookings.setAdminNote(id, formData.get('admin_note'), admin.username);
    return 'note';
  });
}

export async function resendSms(id, formData) {
  await bookingAction(id, async () => {
    const booking = bookings.getById(id);
    if (!booking) throw new bookings.BookingError('not_found');
    const kind = field(formData.get('kind'));
    if (kind === 'confirm') await notify.bookingConfirmed(booking);
    else if (kind === 'reminder') await notify.reminder(booking);
    else if (kind === 'reschedule') await notify.bookingRescheduled(booking);
    else if (kind === 'cancel') await notify.bookingCancelled(booking);
    else throw new bookings.BookingError('sms_kind');
    return 'sms';
  });
}
