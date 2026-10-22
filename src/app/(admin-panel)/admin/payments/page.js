import { db } from '@/db.js';
import { formatPrice } from '@/i18n/index.js';
import { fromMin } from '@/lib/time.js';
import { formatPhone } from '@/lib/phone.js';
import { PAGE_SIZE } from '@/lib/admin-bookings.js';
import { requireAdmin, adminMetadata, formatTs } from '@/lib/admin.js';
import ScrollArea from '@/components/ScrollArea.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Төлбөр');
}

const FILTERS = [
  ['', 'Бүгд'],
  ['paid', 'Төлөгдсөн'],
  ['created', 'Хүлээгдэж буй'],
  ['cancelled', 'Цуцлагдсан'],
];

export default async function PaymentsPage({ searchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const status = ['paid', 'created', 'cancelled'].includes(query.status) ? query.status : '';
  const where = status ? 'WHERE p.status = ?' : '';
  const params = status ? [status] : [];
  const total = db().prepare(`SELECT COUNT(*) AS n FROM payments p ${where}`).get(...params).n;
  const rows = db()
    .prepare(
      `SELECT p.*, b.code, b.customer_name, b.phone, b.date, b.start_min, b.day_only
       FROM payments p JOIN bookings b ON b.id = p.booking_id ${where}
       ORDER BY p.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <h1>Төлбөрийн түүх</h1>
      <nav className="quick-filters">
        {FILTERS.map(([value, label]) => (
          <a key={label} href={value ? `/admin/payments?status=${value}` : '/admin/payments'} aria-current={status === value ? 'true' : undefined}>
            {label}
          </a>
        ))}
      </nav>

      {rows.length ? (
        <ScrollArea className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Үүссэн</th>
                <th>Захиалга</th>
                <th>Үйлчлүүлэгч</th>
                <th>Дүн</th>
                <th>Төрөл</th>
                <th>Төлөв</th>
                <th>Төлсөн</th>
                <th>Нэхэмжлэх</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{formatTs(p.created_at)}</td>
                  <td>
                    <a className="mono" href={`/admin/bookings/${p.booking_id}`}>
                      {p.code}
                    </a>
                    <br />
                    <small>
                      {p.date} {p.day_only ? '' : fromMin(p.start_min)}
                    </small>
                  </td>
                  <td>
                    {p.customer_name}
                    <br />
                    <small>{formatPhone(p.phone)}</small>
                  </td>
                  <td>
                    <strong>{formatPrice(p.amount)}</strong>
                  </td>
                  <td>{p.provider}</td>
                  <td>
                    <span className={`badge badge-pay-${p.status}`}>{p.status}</span>
                  </td>
                  <td>{formatTs(p.paid_at)}</td>
                  <td className="mono small">{p.invoice_id || p.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <p className="a-empty">Төлбөр алга.</p>
      )}

      {pages > 1 && (
        <nav className="pager">
          {page > 1 && (
            <a className="a-btn" href={`?status=${status}&page=${page - 1}`}>
              ← Өмнөх
            </a>
          )}
          <span>
            {page} / {pages}
          </span>
          {page < pages && (
            <a className="a-btn" href={`?status=${status}&page=${page + 1}`}>
              Дараах →
            </a>
          )}
        </nav>
      )}
    </>
  );
}
