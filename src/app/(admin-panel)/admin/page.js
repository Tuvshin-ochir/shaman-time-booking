import config from '@/config.js';
import { db } from '@/db.js';
import * as settings from '@/lib/settings.js';
import * as slots from '@/lib/slots.js';
import { parsePhoneList } from '@/lib/phone.js';
import { nowLocal, addDays, localToEpoch } from '@/lib/time.js';
import { formatDate, formatPrice } from '@/i18n/index.js';
import { requireAdmin, adminMetadata } from '@/lib/admin.js';
import Rows from '@/components/admin/Rows.js';
import ModalLink from '@/components/admin/ModalLink.js';
import NewBookingForm from './bookings/NewBookingForm.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Самбар');
}

export default async function Dashboard() {
  await requireAdmin();
  const now = Date.now();
  const today = nowLocal(now).date;
  const one = (sql, ...params) => db().prepare(sql).get(...params);

  const todays = db()
    .prepare(`SELECT * FROM bookings WHERE date = ? AND ${slots.BLOCKING_SQL} ORDER BY start_min`)
    .all(today, now);
  const upcoming = db()
    .prepare(`SELECT * FROM bookings WHERE status = 'confirmed' AND date > ? ORDER BY date, start_min LIMIT 10`)
    .all(today);
  const stats = {
    today: todays.filter((b) => b.status === 'confirmed').length,
    week: one(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND date BETWEEN ? AND ?`, today, addDays(today, 6)).n,
    pending: one(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending' AND hold_expires_at > ?`, now).n,
    refunds: one(`SELECT COUNT(*) AS n FROM bookings WHERE refund_status = 'pending'`).n,
    revenue: one(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'paid' AND paid_at >= ?`,
      localToEpoch(`${today.slice(0, 8)}01`, 0)
    ).s,
    smsFailed: one(`SELECT COUNT(*) AS n FROM sms_log WHERE status = 'failed' AND created_at > ?`, now - 7 * 86400000).n,
  };

  const warnings = [];
  if (config.qpay.mode === 'mock') warnings.push('QPay туршилтын (mock) горимд байна — жинхэнэ төлбөр авахгүй. .env дотор QPAY_MODE=live болгоно.');
  if (config.qpay.mode === 'sandbox') warnings.push('QPay sandbox (тест) орчинд холбогдсон байна.');
  if (config.sms.provider === 'console') warnings.push('SMS илгээгдэхгүй байна (SMS_PROVIDER=console). docs/SMS_SETUP.md-г үзнэ үү.');
  if (!parsePhoneList(settings.get('sms').staff_phones).valid.length) {
    warnings.push('Бөөгийн утасны дугаар оруулаагүй тул шинэ захиалгын SMS бөөд очихгүй. Тохиргоо → SMS.');
  }
  if (settings.get('business').address === settings.DEFAULTS.business.address) {
    warnings.push('Байгууллагын хаяг, утас анхны жишээ утгатай байна. Тохиргоо → Байгууллага.');
  }
  if (config.isProd && !config.baseUrl.startsWith('https://')) warnings.push('BASE_URL https биш байна.');

  return (
    <>
      <div className="a-head">
        <h1>Өнөөдөр · {formatDate(today)}</h1>
        <div className="a-head-actions">
          <ModalLink
            key={now}
            className="a-btn a-btn-primary"
            href="/admin/bookings/new"
            title="Гараар захиалга нэмэх"
            content={<NewBookingForm date={today} />}
          >
            + Захиалга нэмэх
          </ModalLink>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="a-alert a-alert-warn">
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="stats">
        <a className="stat" href="/admin/bookings?view=today&status=confirmed">
          <span>Өнөөдрийн захиалга</span>
          <strong>{stats.today}</strong>
        </a>
        <a className="stat" href="/admin/bookings?view=upcoming&status=confirmed">
          <span>Ирэх 7 хоногт</span>
          <strong>{stats.week}</strong>
        </a>
        <a className="stat" href="/admin/bookings?view=all&status=pending">
          <span>Төлбөр хүлээж буй</span>
          <strong>{stats.pending}</strong>
        </a>
        <a className={`stat${stats.refunds ? ' stat-alert' : ''}`} href="/admin/bookings?view=all&status=refund">
          <span>Буцаалт хийх</span>
          <strong>{stats.refunds}</strong>
        </a>
        <a className="stat" href="/admin/payments?status=paid">
          <span>Энэ сарын орлого</span>
          <strong>{formatPrice(stats.revenue)}</strong>
        </a>
        <a className={`stat${stats.smsFailed ? ' stat-alert' : ''}`} href="/admin/sms">
          <span>SMS алдаа (7 хоног)</span>
          <strong>{stats.smsFailed}</strong>
        </a>
      </div>

      <section className="a-section">
        <div className="a-section-head">
          <h2>Өнөөдрийн хуваарь</h2>
          <a href="/admin/bookings?view=today&status=all">Бүгдийг харах →</a>
        </div>
        {todays.length ? <Rows rows={todays} showDate={false} /> : <p className="a-empty">Өнөөдөр захиалга алга.</p>}
      </section>

      <section className="a-section">
        <div className="a-section-head">
          <h2>Удахгүй болох</h2>
          <a href="/admin/bookings?view=upcoming&status=confirmed">Бүгд →</a>
        </div>
        {upcoming.length ? <Rows rows={upcoming} /> : <p className="a-empty">Ирээдүйн захиалга алга.</p>}
      </section>
    </>
  );
}
