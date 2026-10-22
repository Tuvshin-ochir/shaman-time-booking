import { db } from '@/db.js';
import { bookingQuery, PAGE_SIZE } from '@/lib/admin-bookings.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import { nowLocal } from '@/lib/time.js';
import Rows from '@/components/admin/Rows.js';
import ModalLink from '@/components/admin/ModalLink.js';
import BookingFilters from './BookingFilters.js';
import NewBookingForm from './NewBookingForm.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Захиалга');
}

const QUICK = [
  ['today', 'all', 'Өнөөдөр'],
  ['upcoming', 'active', 'Ирэх'],
  ['all', 'paid', 'Төлсөн'],
  ['all', 'cancelled', 'Цуцалсан'],
  ['all', 'refund', 'Буцаалт хийх'],
];

export default async function BookingsPage({ searchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const { filters, sql, order, params } = bookingQuery(query);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const total = db().prepare(`SELECT COUNT(*) AS n ${sql}`).get(...params).n;
  const rows = db()
    .prepare(`SELECT * ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = new URLSearchParams({ view: filters.view, status: filters.status, date: filters.date, q: filters.q }).toString();

  return (
    <>
      <div className="a-head">
        <h1>
          Захиалга <small className="a-count">{total}</small>
        </h1>
        <div className="a-head-actions">
          <a className="a-btn" href={`/admin/bookings.csv?${qs}`}>
            CSV татах
          </a>
          <ModalLink
            key={Date.now()}
            className="a-btn a-btn-primary"
            href="/admin/bookings/new"
            title="Гараар захиалга нэмэх"
            content={<NewBookingForm date={nowLocal().date} />}
          >
            + Захиалга нэмэх
          </ModalLink>
        </div>
      </div>

      <nav className="quick-filters" aria-label="Түргэн шүүлтүүр">
        {QUICK.map(([view, status, label]) => (
          <a
            key={label}
            href={`/admin/bookings?view=${view}&status=${status}`}
            aria-current={(status === 'refund' ? filters.status === 'refund' : filters.view === view && filters.status === status) ? 'true' : undefined}
          >
            {label}
          </a>
        ))}
      </nav>

      <BookingFilters filters={filters} />

      {rows.length ? <Rows rows={rows} /> : <p className="a-empty">Захиалга олдсонгүй.</p>}

      {pages > 1 && (
        <nav className="pager">
          {page > 1 && (
            <a className="a-btn" href={`?${qs}&page=${page - 1}`}>
              ← Өмнөх
            </a>
          )}
          <span>
            {page} / {pages}
          </span>
          {page < pages && (
            <a className="a-btn" href={`?${qs}&page=${page + 1}`}>
              Дараах →
            </a>
          )}
        </nav>
      )}
    </>
  );
}
