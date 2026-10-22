'use client';

import TEXTS from '@/i18n/mn.js';

// Unexpected server errors. Runs in the browser, so it uses the default texts.
export default function SiteError() {
  return (
    <div className="page-default">
      <main id="main">
        <section className="section">
          <div className="container narrow result-card">
            <h1>{TEXTS['err.500_title']}</h1>
            <p className="muted">{TEXTS['err.500_text']}</p>
            <p>
              <a className="btn btn-primary" href="/">
                {TEXTS['booking.home']}
              </a>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
