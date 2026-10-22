import * as bookings from '@/lib/bookings.js';
import { STATUS_LABELS } from '@/lib/admin-messages.js';

export default function Badge({ b }) {
  const st = bookings.effectiveStatus(b);
  return (
    <>
      <span className={`badge badge-${st}`}>{STATUS_LABELS[st] || st}</span>
      {b.refund_status === 'pending' ? (
        <>
          {' '}
          <span className="badge badge-refund">Буцаалт хүлээгдэж буй</span>
        </>
      ) : b.refund_status === 'done' ? (
        <>
          {' '}
          <span className="badge badge-muted">Буцаасан</span>
        </>
      ) : null}
    </>
  );
}
