import { formatDate, formatPrice } from '@/i18n/index.js';
import { fromMin } from '@/lib/time.js';
import { formatPhone } from '@/lib/phone.js';
import { MEETING_LABELS } from '@/lib/admin-messages.js';
import Badge from './Badge.js';

// Booking list rows (dashboard and booking list). The column names show on
// wider screens; each row is a link to the booking.
export default function Rows({ rows, showDate = true }) {
  return (
    <div className="b-list">
      <div className="b-row b-head" aria-hidden="true">
        <span>{showDate ? 'Өдөр, цаг' : 'Цаг'}</span>
        <span>Үйлчлүүлэгч</span>
        <span>Үйлчилгээ</span>
        <span>Хэлбэр</span>
        <span>Төлөв</span>
        <span className="b-paid">Төлсөн</span>
      </div>
      {rows.map((b) => (
        <a key={b.id} className="b-row" href={`/admin/bookings/${b.id}`}>
          <span className="b-when">
            {/* Day-only bookings (special services) have no time. */}
            <strong>{b.day_only ? 'Цаггүй' : fromMin(b.start_min)}</strong>
            {showDate && <small>{formatDate(b.date)}</small>}
          </span>
          <span className="b-who">
            <strong>{b.customer_name}</strong>
            <small>
              {formatPhone(b.phone)} · <span className="mono">{b.code}</span>
            </small>
          </span>
          <span className="b-what">{b.service_name}</span>
          <span className="b-meeting">
            <span className={`badge ${b.meeting === 'online' ? 'badge-online' : 'badge-in-person'}`}>
              {MEETING_LABELS[b.meeting] || MEETING_LABELS.in_person}
            </span>
          </span>
          <span className="b-status">
            <Badge b={b} />
          </span>
          <span className="b-paid">{b.paid_amount ? formatPrice(b.paid_amount) : '—'}</span>
        </a>
      ))}
    </div>
  );
}
