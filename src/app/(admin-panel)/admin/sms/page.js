import { db } from '@/db.js';
import { formatPhone } from '@/lib/phone.js';
import { requireAdmin, adminMetadata, formatTs } from '@/lib/admin.js';
import ScrollArea from '@/components/ScrollArea.js';
import { resend } from './actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('SMS');
}

export default async function SmsPage() {
  await requireAdmin();
  const rows = db()
    .prepare(`SELECT s.*, b.code FROM sms_log s LEFT JOIN bookings b ON b.id = s.booking_id ORDER BY s.id DESC LIMIT 200`)
    .all();
  return (
    <>
      <h1>SMS түүх</h1>
      <p className="muted">Сүүлийн 200 SMS. Алдаатай SMS-ийг «Дахин илгээх» товчоор илгээнэ.</p>

      {rows.length ? (
        <ScrollArea className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Огноо</th>
                <th>Хэнд</th>
                <th>Төрөл</th>
                <th>Захиалга</th>
                <th>Төлөв</th>
                <th>Текст</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{formatTs(s.created_at)}</td>
                  <td>{formatPhone(s.to_phone)}</td>
                  <td>{s.kind}</td>
                  <td>
                    {s.booking_id ? (
                      <a className="mono" href={`/admin/bookings/${s.booking_id}`}>
                        {s.code}
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge badge-sms-${s.status}`}>{s.status === 'sent' ? 'илгээсэн' : 'алдаа'}</span>
                    {s.status === 'failed' && s.provider_response && (
                      <>
                        <br />
                        {/* Long enough for the explanation of WeSend errors (src/lib/sms.js). */}
                        <small className="muted">{s.provider_response.slice(0, 260)}</small>
                      </>
                    )}
                  </td>
                  <td className="small">{s.body}</td>
                  <td>
                    {s.status === 'failed' && (
                      <form action={resend.bind(null, s.id)}>
                        <button className="a-btn a-btn-sm" type="submit">
                          Дахин илгээх
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      ) : (
        <p className="a-empty">SMS илгээгээгүй байна.</p>
      )}
    </>
  );
}
