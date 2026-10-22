import Paragraphs from '../Paragraphs.js';

// The cancellation policy (src/lib/policy.js), shown on /policy and in the
// policy dialog of every other page (PolicyDialog.js).

const ICONS = {
  good: <path d="M6 12.5l4 4 8-9" />,
  warn: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </>
  ),
  bad: <path d="M7 7l10 10M17 7L7 17" />,
};

// Introduction and "last updated" date.
export function PolicyIntro({ policy, t }) {
  return (
    <>
      {policy.intro_mn && (
        <div className="lead">
          <Paragraphs text={policy.intro_mn} />
        </div>
      )}
      {policy.updated_at && (
        <p className="policy-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>{' '}
          {t('policy.updated')}: {policy.updated_at.replace(/-/g, '.')}
        </p>
      )}
    </>
  );
}

// The rules in short (coloured cards), then the numbered sections.
export function PolicyDetails({ policy, t }) {
  return (
    <>
      {policy.highlights.length > 0 && (
        <>
          <h2 className="policy-label">{t('policy.in_short')}</h2>
          <div className="policy-cards">
            {policy.highlights.map((h, i) => (
              <div key={i} className={`policy-card tone-${h.tone}`}>
                <span className="policy-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[h.tone] || ICONS.good}
                  </svg>
                </span>
                <div>
                  <h3>{h.title_mn}</h3>
                  {h.text_mn && <p>{h.text_mn}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {policy.sections.length > 0 && (
        <>
          <h2 className="policy-label">{t('policy.details')}</h2>
          <div className="policy-sections">
            {policy.sections.map((s, i) => (
              <section key={i} className="policy-section">
                <h3>
                  <span className="policy-num">{i + 1}</span>
                  {s.title_mn}
                </h3>
                <div className="prose">
                  <Paragraphs text={s.body_mn} />
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
