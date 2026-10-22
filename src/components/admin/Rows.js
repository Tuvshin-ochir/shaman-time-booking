import { formatDate, formatPrice } from '@/i18n/index.js';
import { fromMin } from '@/lib/time.js';
import { formatPhone } from '@/lib/phone.js';
import Badge from './Badge.js';

// Booking list rows (dashboard and booking list).
export default function Rows({ rows, showDate = true }) {
  return (
    <div className="b-list">
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
          <span className="b-status">
            <Badge b={b} />
          </span>
          <span className="b-paid">{b.paid_amount ? formatPrice(b.paid_amount) : '—'}</span>
        </a>
      ))}
    </div>
  );
}
