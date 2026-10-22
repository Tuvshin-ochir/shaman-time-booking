import { db } from '@/db.js';
import * as settings from '@/lib/settings.js';
import * as bookings from '@/lib/bookings.js';
import { siteTranslator } from '@/i18n/index.js';
import { pageMetadata } from '@/lib/site.js';
import SitePage from '@/components/site/SitePage.js';
import BookForm from './BookForm.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return pageMetadata({ title: siteTranslator()('book.title'), path: '/book' });
}

function bookingServices() {
  return db()
    .prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id')
    .all()
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: s.price,
      amountDue: bookings.amountDue(s),
      duration: s.duration_min,
      dayOnly: s.kind === 'special',
    }));
}

const field = (value) => String(Array.isArray(value) ? value[0] : (value ?? '')).trim();

export default async function BookPage({ searchParams }) {
  const query = await searchParams;
  const t = siteTranslator();
  const services = bookingServices();
  const form = { service_id: field(query.service), date: field(query.date), time: field(query.time) };
  const labels = Object.fromEntries(
    [
      'book.noscript', 'book.step_service', 'book.step_contact', 'book.step_confirm',
      'book.name', 'book.name_ph', 'book.phone', 'book.phone_ph', 'book.phone_hint', 'book.note',
      'book.meeting', 'book.meeting_in_person', 'book.meeting_in_person_hint', 'book.meeting_online',
      'book.meeting_online_hint', 'book.summary_meeting',
      'book.summary_service', 'book.summary_price', 'book.summary_pay_now',
      'book.summary_balance', 'book.agree', 'book.read_policy', 'book.submit',
    ].map((key) => [key, t(key)])
  );
  labels['book.hold_note'] = t('book.hold_note', { minutes: settings.get('schedule').hold_minutes });
  // Messages for the step-by-step picker.
  const strings = {
    loading: t('book.loading'),
    noTimes: t('book.no_times'),
    noDays: t('book.no_days'),
    closed: t('book.closed'),
    full: t('book.full'),
    free: t('book.free'),
    errPhone: t('err.phone'),
    errName: t('err.name'),
    errTime: t('book.select_time_first'),
    errDay: t('book.select_day_first'),
    stepTime: t('book.step_time'),
    stepDay: t('book.step_day'),
    dayOnlyHint: t('book.day_only_hint'),
    noOpenDays: t('book.no_open_days'),
    whenLabel: t('book.summary_when'),
    dayLabel: t('book.summary_day'),
    dayOnly: t('services.day_only'),
    errAgree: t('err.agree'),
    errMeeting: t('err.meeting'),
    errGeneric: t('err.generic'),
    submit: t('book.submit'),
    submitFree: t('book.submit_free'),
    duration: t('services.duration'),
  };

  return (
    <SitePage page="book" path="/book" sticky={false}>
      <section className="section section-tight">
        <div className="container narrow">
          <h1>{t('book.title')}</h1>
          {services.length ? (
            <BookForm services={services} form={form} labels={labels} strings={strings} />
          ) : (
            <p className="muted">{t('services.empty')}</p>
          )}
        </div>
      </section>
    </SitePage>
  );
}
