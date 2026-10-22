import { notFound, redirect } from 'next/navigation';
import { db } from '@/db.js';
import * as bookings from '@/lib/bookings.js';
import * as qpay from '@/lib/qpay.js';
import { siteTranslator, formatWhen, formatPrice } from '@/i18n/index.js';
import { pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import PayPanel from './PayPanel.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { token } = await params;
  return pageMetadata({ title: siteTranslator()('pay.title'), path: `/pay/${token}` });
}

function latestInvoice(bookingId) {
  return (
    db()
      .prepare(`SELECT * FROM payments WHERE booking_id = ? AND invoice_id IS NOT NULL ORDER BY id DESC LIMIT 1`)
      .get(bookingId) || null
  );
}

export default async function PayPage({ params }) {
  const { token } = await params;
  const booking = bookings.getByToken(token);
  if (!booking) notFound();
  const status = bookings.effectiveStatus(booking);
  if (status === 'confirmed') redirect(`/booking/${booking.token}`);

  const t = siteTranslator();
  const payment = status === 'pending' ? latestInvoice(booking.id) : null;
  let deeplinks = [];
  try {
    deeplinks = payment && payment.deeplinks ? JSON.parse(payment.deeplinks) : [];
  } catch {
    deeplinks = [];
  }
  const labels = Object.fromEntries(
    [
      'pay.title', 'pay.amount', 'pay.time_left', 'pay.mock_note', 'pay.mock_pay', 'pay.open_bank', 'pay.scan',
      'pay.short_url', 'pay.waiting', 'pay.check', 'pay.checking', 'pay.not_yet', 'nav.policy', 'pay.retry',
    ].map((key) => [key, t(key)])
  );

  return (
    <SitePage page="pay" path={`/pay/${booking.token}`} sticky={false}>
      <section className="section section-tight">
        <div className="container narrow">
          <PayPanel
            active={status === 'pending' && !!payment}
            token={booking.token}
            expiresAt={booking.hold_expires_at}
            serverNow={Date.now()}
            amount={payment ? formatPrice(payment.amount) : ''}
            bookingLine={`${booking.service_name} · ${formatWhen(booking)}${booking.meeting === 'online' ? ` · ${t('book.meeting_online')}` : ''}`}
            code={booking.code}
            mock={qpay.isMock()}
            deeplinks={deeplinks
              .filter((d) => d && /^[a-z][a-z0-9+.-]*:/i.test(d.link || ''))
              .map((d) => ({ link: d.link, logo: d.logo || '', name: d.description || d.name }))}
            qrImage={payment ? payment.qr_image : null}
            shortUrl={payment ? payment.short_url : null}
            labels={labels}
            expired={{
              title: status === 'cancelled' ? t('booking.title_cancelled') : t('pay.expired_title'),
              text: status === 'pending' && !payment ? t('pay.no_invoice') : t('pay.expired_text'),
              retryHref: `/book?service=${booking.service_id}`,
            }}
          />
        </div>
      </section>
    </SitePage>
  );
}
