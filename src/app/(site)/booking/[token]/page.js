import { notFound } from 'next/navigation';
import * as settings from '@/lib/settings.js';
import * as bookings from '@/lib/bookings.js';
import { siteTranslator, formatWhen, formatPrice } from '@/i18n/index.js';
import { formatPhone } from '@/lib/phone.js';
import { telHref, pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { token } = await params;
  const booking = bookings.getByToken(token);
  const status = booking ? bookings.effectiveStatus(booking) : 'expired';
  return pageMetadata({ title: siteTranslator()(`booking.title_${status}`), path: `/booking/${token}` });
}

export default async function BookingPage({ params }) {
  const { token } = await params;
  const booking = bookings.getByToken(token);
  if (!booking) notFound();
  const status = bookings.effectiveStatus(booking);
  const t = siteTranslator();
  const business = settings.get('business');
  const tel = telHref(business.phone);

  return (
    <SitePage page="booking" path={`/booking/${booking.token}`} sticky={status !== 'confirmed' && status !== 'pending'}>
      <section className="section section-tight">
        <div className="container narrow">
          <div className={`result-card status-${status}`}>
            <div className="result-icon" aria-hidden="true">
              {status === 'confirmed' ? '✓' : status === 'pending' ? '…' : '!'}
            </div>
            <h1>{t(`booking.title_${status}`)}</h1>
            {status === 'confirmed' && <p className="muted">{t('booking.sms_sent', { phone: formatPhone(booking.phone) })}</p>}

            <dl className="summary">
              <div>
                <dt>{t('booking.code')}</dt>
                <dd>
                  <span className="code">{booking.code}</span>
                </dd>
              </div>
              <div>
                <dt>{t('booking.name')}</dt>
                <dd>{booking.customer_name}</dd>
              </div>
              <div>
                <dt>{t('booking.service')}</dt>
                <dd>{booking.service_name}</dd>
              </div>
              <div>
                <dt>{t(booking.day_only ? 'booking.day' : 'booking.when')}</dt>
                <dd>
                  <strong>{formatWhen(booking)}</strong>
                </dd>
              </div>
              <div>
                <dt>{t('booking.address')}</dt>
                <dd>{business.address}</dd>
              </div>
              {booking.paid_amount > 0 && (
                <div>
                  <dt>{t('booking.paid')}</dt>
                  <dd>{formatPrice(booking.paid_amount)}</dd>
                </div>
              )}
              {status === 'confirmed' && booking.price > booking.paid_amount && (
                <div>
                  <dt>{t('booking.balance')}</dt>
                  <dd>{formatPrice(booking.price - booking.paid_amount)}</dd>
                </div>
              )}
            </dl>

            {status === 'confirmed' ? (
              <>
                {!booking.day_only && <p className="hint">{t('booking.arrive_note')}</p>}
                <div className="actions">
                  <a className="btn btn-secondary" href={`/booking/${booking.token}/calendar.ics`}>
                    {t('booking.add_calendar')}
                  </a>{' '}
                  {business.map_url && (
                    <a className="btn btn-ghost" href={business.map_url} target="_blank" rel="noopener">
                      {t('contact.map')}
                    </a>
                  )}
                </div>
              </>
            ) : status === 'pending' ? (
              <p>
                <a className="btn btn-primary btn-block" href={`/pay/${booking.token}`}>
                  {t('booking.go_pay')}
                </a>
              </p>
            ) : (
              <>
                {booking.refund_status === 'pending' && <p className="alert alert-info">{t('booking.refund_note')}</p>}
                <p>
                  <a className="btn btn-primary" href={`/book?service=${booking.service_id}`}>
                    {t('pay.retry')}
                  </a>
                </p>
              </>
            )}

            <p className="hint">
              {t('booking.contact_us', { phone: business.phone })} <a href={tel}>{t('contact.call')}</a>
            </p>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
