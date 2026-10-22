import { formatPrice } from '@/i18n/index.js';

export default function ServiceCard({ s, t }) {
  return (
    <article className="service-card">
      <div className="service-card-body">
        <h3>{s.name}</h3>
        {s.description && <p className="muted">{s.description}</p>}
        <p className="chips">
          <span className="chip">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>{' '}
            {s.kind === 'special' ? t('services.day_only') : t('services.duration', { n: s.duration_min })}
          </span>{' '}
          {s.deposit !== null && s.deposit < s.price && (
            <span className="chip chip-accent">{t('services.deposit', { amount: formatPrice(s.deposit) })}</span>
          )}
        </p>
      </div>
      <div className="service-card-foot">
        <span className="price">{formatPrice(s.price)}</span>
        <a className="btn btn-primary btn-sm" href={`/book?service=${s.id}`}>
          {t('services.book')}
        </a>
      </div>
    </article>
  );
}
