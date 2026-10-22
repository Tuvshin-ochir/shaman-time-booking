import { notFound } from 'next/navigation';
import { db } from '@/db.js';
import * as bookings from '@/lib/bookings.js';
import { formatWhen, formatPrice } from '@/i18n/index.js';
import { fromMin } from '@/lib/time.js';
import { formatPhone } from '@/lib/phone.js';
import { EVENT_LABELS } from '@/lib/admin-messages.js';
import { requireAdmin, adminMetadata, formatTs } from '@/lib/admin.js';
import ActionForm from '@/components/admin/ActionForm.js';
import SlotPicker from '@/components/admin/SlotPicker.js';
import Badge from '@/components/admin/Badge.js';
import ScrollArea from '@/components/ScrollArea.js';
import { cancelBooking, rescheduleBooking, markRefunded, recordPayment, saveNote, resendSms } from '../actions.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const booking = bookings.getById(Number((await params).id));
  return adminMetadata(booking ? `Захиалга ${booking.code}` : 'Олдсонгүй');
}

export default async function BookingPage({ params }) {
  await requireAdmin();
  const id = Number((await params).id);
  const booking = bookings.getById(id);
  if (!booking) notFound();
  const status = bookings.effectiveStatus(booking);
  const active = status === 'confirmed' || status === 'pending';
  const payments = db().prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC').all(id);
  const events = db().prepare('SELECT * FROM booking_events WHERE booking_id = ? ORDER BY id DESC').all(id);
  const smsLog = db().prepare('SELECT * FROM sms_log WHERE booking_id = ? ORDER BY id DESC').all(id);

  return (
    <>
      <p>
        <a href="/admin/bookings">← Захиалгын жагсаалт</a>
      </p>
      <div className="a-head">
        <h1>
          <span className="mono">{booking.code}</span> <Badge b={booking} />
        </h1>
      </div>

      <div className="detail-grid">
        <section className="a-card">
          <h2>Мэдээлэл</h2>
          <dl className="a-dl">
            <dt>{booking.day_only ? 'Өдөр' : 'Өдөр, цаг'}</dt>
            <dd>
              <strong>{formatWhen(booking, { end: true })}</strong>
              {booking.day_only ? (
                <>
                  {' '}
                  <span className="badge badge-special">Тусгай · цаггүй</span>
                </>
              ) : null}
            </dd>
            <dt>Үйлчилгээ</dt>
            <dd>{booking.service_name}</dd>
            <dt>Нэр</dt>
            <dd>{booking.customer_name}</dd>
            <dt>Утас</dt>
            <dd>
              <a href={`tel:${booking.phone}`}>{formatPhone(booking.phone)}</a>
            </dd>
            {booking.note && (
              <>
                <dt>Үйлчлүүлэгчийн тайлбар</dt>
                <dd>{booking.note}</dd>
              </>
            )}
            <dt>Үнэ</dt>
            <dd>{formatPrice(booking.price)}</dd>
            {booking.amount_due ? (
              <>
                <dt>Онлайнаар төлөх</dt>
                <dd>{formatPrice(booking.amount_due)}</dd>
              </>
            ) : null}
            <dt>Төлсөн</dt>
            <dd>
              {formatPrice(booking.paid_amount)}
              {booking.paid_at ? (
                <>
                  {' '}
                  <small className="muted">({formatTs(booking.paid_at)})</small>
                </>
              ) : null}
            </dd>
            <dt>Эх сурвалж</dt>
            <dd>{booking.source === 'admin' ? 'Админ гараар' : 'Вэбсайт'}</dd>
            <dt>Үүссэн</dt>
            <dd>{formatTs(booking.created_at)}</dd>
            {status === 'pending' && (
              <>
                <dt>Цаг барих хугацаа</dt>
                <dd>{formatTs(booking.hold_expires_at)} хүртэл</dd>
              </>
            )}
            {booking.reminder_sent_at ? (
              <>
                <dt>Сануулга</dt>
                <dd>{formatTs(booking.reminder_sent_at)} илгээсэн</dd>
              </>
            ) : null}
            {booking.cancel_reason && (
              <>
                <dt>Цуцалсан шалтгаан</dt>
                <dd>{booking.cancel_reason}</dd>
              </>
            )}
          </dl>
          <p className="muted small">
            Үйлчлүүлэгчийн хуудас:{' '}
            <a href={`/booking/${booking.token}`} target="_blank" rel="noopener">
              /booking/…
            </a>
          </p>
        </section>

        <div className="detail-actions">
          {booking.refund_status === 'pending' && (
            <section className="a-card a-card-alert">
              <h2>Буцаалт хийх шаардлагатай</h2>
              <p className="small">
                Төлсөн дүн: <strong>{formatPrice(booking.paid_amount)}</strong>. QPay merchant эсвэл банкаар буцаалт хийсний дараа доорх товчийг дарна уу.
              </p>
              <ActionForm action={markRefunded.bind(null, id)} confirm="Буцаалт хийгдсэн гэж тэмдэглэх үү?" confirmLabel="Тэмдэглэх">
                <button className="a-btn a-btn-primary" type="submit">
                  Буцаалт хийгдсэн
                </button>
              </ActionForm>
            </section>
          )}

          {active && (
            <>
              <section className="a-card">
                <h2>{booking.day_only ? 'Өдөр шилжүүлэх' : 'Цаг шилжүүлэх'}</h2>
                <form action={rescheduleBooking.bind(null, id)} className="a-form" data-slot-picker data-booking={booking.id}>
                  <SlotPicker date={booking.date} time={fromMin(booking.start_min)} bookingId={booking.id} dayOnly={!!booking.day_only} />
                  {!booking.day_only && (
                    <label className="a-check">
                      <input type="checkbox" name="force" /> Давхцлыг үл тоох
                    </label>
                  )}
                  <label className="a-check">
                    <input type="checkbox" name="notify" defaultChecked /> Үйлчлүүлэгчид SMS илгээх
                  </label>
                  <button className="a-btn a-btn-primary" type="submit">
                    Шилжүүлэх
                  </button>
                </form>
              </section>

              <section className="a-card">
                <h2>Цуцлах</h2>
                <ActionForm action={cancelBooking.bind(null, id)} className="a-form" confirm="Энэ захиалгыг цуцлах уу?" confirmLabel="Цуцлах" confirmDanger>
                  <label>
                    Шалтгаан <input name="reason" maxLength={300} placeholder="Жишээ: Үйлчлүүлэгч хүсэлт гаргасан" />
                  </label>
                  {booking.paid_amount > 0 && (
                    <label className="a-check">
                      <input type="checkbox" name="refund" defaultChecked /> Төлбөр буцаах шаардлагатай гэж тэмдэглэх
                    </label>
                  )}
                  <label className="a-check">
                    <input type="checkbox" name="notify" defaultChecked /> Үйлчлүүлэгчид SMS илгээх
                  </label>
                  <button className="a-btn a-btn-danger" type="submit">
                    Захиалга цуцлах
                  </button>
                </ActionForm>
              </section>
            </>
          )}

          <section className="a-card">
            <h2>Гараар төлбөр бүртгэх</h2>
            <form action={recordPayment.bind(null, id)} className="a-form">
              <div className="a-row">
                <label>
                  Дүн (₮) <input name="amount" inputMode="numeric" required placeholder={String(Math.max(0, booking.price - booking.paid_amount))} />
                </label>
                <label>
                  Тайлбар <input name="note" maxLength={200} placeholder="Бэлэн / шилжүүлэг" />
                </label>
              </div>
              <button className="a-btn" type="submit">
                Бүртгэх
              </button>
            </form>
          </section>

          <section className="a-card">
            <h2>Дотоод тэмдэглэл</h2>
            <form action={saveNote.bind(null, id)} className="a-form">
              <textarea name="admin_note" rows={3} maxLength={1000} placeholder="Зөвхөн админд харагдана" defaultValue={booking.admin_note || ''}></textarea>
              <button className="a-btn" type="submit">
                Хадгалах
              </button>
            </form>
          </section>

          <section className="a-card">
            <h2>SMS дахин илгээх</h2>
            <form action={resendSms.bind(null, id)} className="a-form a-inline">
              <select name="kind">
                <option value="confirm">Баталгаажуулалт (үйлчлүүлэгч + бөө)</option>
                <option value="reminder">Сануулга</option>
                <option value="reschedule">Цаг өөрчлөгдсөн</option>
                <option value="cancel">Цуцлагдсан</option>
              </select>
              <button className="a-btn" type="submit">
                Илгээх
              </button>
            </form>
          </section>
        </div>
      </div>

      <section className="a-section">
        <h2>Төлбөр</h2>
        {payments.length ? (
          <ScrollArea className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Огноо</th>
                  <th>Төрөл</th>
                  <th>Дүн</th>
                  <th>Төлөв</th>
                  <th>Нэхэмжлэх / гүйлгээ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatTs(p.created_at)}</td>
                    <td>{p.provider}</td>
                    <td>{formatPrice(p.amount)}</td>
                    <td>
                      <span className={`badge badge-pay-${p.status}`}>{p.status}</span>
                      {p.paid_at ? (
                        <>
                          {' '}
                          <small>{formatTs(p.paid_at)}</small>
                        </>
                      ) : null}
                    </td>
                    <td className="mono small">
                      {p.invoice_id || ''}
                      {p.provider_payment_id && (
                        <>
                          <br />
                          {p.provider_payment_id}
                        </>
                      )}
                      {p.note && (
                        <>
                          <br />
                          {p.note}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <p className="a-empty">Төлбөр алга.</p>
        )}
      </section>

      <section className="a-section">
        <h2>SMS</h2>
        {smsLog.length ? (
          <ScrollArea className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Огноо</th>
                  <th>Хэнд</th>
                  <th>Төрөл</th>
                  <th>Төлөв</th>
                  <th>Текст</th>
                </tr>
              </thead>
              <tbody>
                {smsLog.map((s) => (
                  <tr key={s.id}>
                    <td>{formatTs(s.created_at)}</td>
                    <td>{formatPhone(s.to_phone)}</td>
                    <td>{s.kind}</td>
                    <td>
                      <span className={`badge badge-sms-${s.status}`}>{s.status === 'sent' ? 'илгээсэн' : 'алдаа'}</span>
                    </td>
                    <td className="small">{s.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <p className="a-empty">SMS илгээгээгүй.</p>
        )}
      </section>

      <section className="a-section">
        <h2>Түүх</h2>
        <ol className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <time>{formatTs(e.created_at)}</time> <strong>{EVENT_LABELS[e.type] || e.type}</strong>
              {e.detail ? ` — ${e.detail}` : ''} <small className="muted">({e.actor})</small>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
