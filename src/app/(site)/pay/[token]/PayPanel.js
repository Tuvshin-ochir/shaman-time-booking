'use client';

import { useEffect, useRef, useState } from 'react';

function formatLeft(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// QPay invoice with a countdown. Polls the booking status until it is paid
// (-> booking page) or the hold runs out (-> "expired" card).
export default function PayPanel({ active, token, expiresAt, serverNow, amount, bookingLine, code, mock, deeplinks, qrImage, shortUrl, labels: L, expired }) {
  const [left, setLeft] = useState(null);
  const [finished, setFinished] = useState(!active);
  const [checking, setChecking] = useState(false);
  const [statusText, setStatusText] = useState(null);
  const done = useRef(!active);
  const root = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const skew = serverNow - Date.now();
    const tick = () => setLeft(Math.max(0, expiresAt - (Date.now() + skew)));
    tick();
    const timers = [setInterval(tick, 1000), setInterval(() => poll(false), 4000)];
    // Coming back from the bank app: check right away.
    const onVisible = () => !document.hidden && poll(true);
    document.addEventListener('visibilitychange', onVisible);
    // Bank logos are hosted by QPay; hide the ones that failed before this ran.
    root.current.querySelectorAll('.bank img').forEach((img) => {
      if (img.complete && img.naturalWidth === 0) img.hidden = true;
    });
    return () => {
      timers.forEach(clearInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function poll(force) {
    if (done.current) return null;
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(token)}/status${force ? '?force=1' : ''}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.status === 'confirmed') {
        done.current = true;
        window.location.replace(`/booking/${encodeURIComponent(token)}`);
      } else if (data.status === 'expired' || data.status === 'cancelled') {
        done.current = true;
        setFinished(true);
      }
      return data.status;
    } catch {
      return null;
    }
  }

  async function check() {
    setChecking(true);
    const status = await poll(true);
    setChecking(false);
    if (status === 'pending') setStatusText(L['pay.not_yet']);
  }

  return (
    <>
      {active && (
        <div className="pay" id="pay" hidden={finished} ref={root}>
          <h1>{L['pay.title']}</h1>

          <div className="pay-head">
            <div>
              <p className="pay-label">{L['pay.amount']}</p>
              <p className="pay-amount">{amount}</p>
            </div>
            <div className="pay-timer">
              <p className="pay-label">{L['pay.time_left']}</p>
              <p className={`pay-countdown${left !== null && left < 2 * 60000 ? ' is-low' : ''}`} id="countdown">
                {left === null ? '--:--' : formatLeft(left)}
              </p>
            </div>
          </div>
          <p className="pay-booking">
            {bookingLine} · <span className="code">{code}</span>
          </p>

          {mock && (
            <div className="alert alert-info">
              <p>{L['pay.mock_note']}</p>
              <form method="post" action={`/mock/pay/${token}`}>
                <button className="btn btn-primary btn-sm" type="submit">
                  {L['pay.mock_pay']}
                </button>
              </form>
            </div>
          )}

          {deeplinks.length > 0 && (
            <div className="banks">
              <h2 className="h3">{L['pay.open_bank']}</h2>
              <div className="bank-grid">
                {deeplinks.map((d, i) => (
                  <a key={i} className="bank" href={d.link}>
                    {d.logo && (
                      <img src={d.logo} alt="" width="40" height="40" onError={(e) => (e.currentTarget.hidden = true)} />
                    )}
                    <span>{d.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="qr-block">
            <p className="muted">{L['pay.scan']}</p>
            {qrImage ? (
              <img className="qr" src={`data:image/png;base64,${qrImage}`} width="240" height="240" alt="QPay QR" />
            ) : (
              <div className="qr qr-placeholder" aria-hidden="true">
                QR
              </div>
            )}
            {shortUrl && (
              <p>
                <a className="btn btn-ghost btn-sm" href={shortUrl} rel="noopener">
                  {L['pay.short_url']}
                </a>
              </p>
            )}
          </div>

          <p className="pay-status" id="pay-status" aria-live="polite">
            {statusText ?? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                {L['pay.waiting']}
              </>
            )}
          </p>
          <button className="btn btn-secondary btn-block" type="button" id="check-btn" disabled={checking} onClick={check}>
            {checking ? L['pay.checking'] : L['pay.check']}
          </button>
          <p className="hint center">
            <a href="/policy">
              {L['nav.policy']}
            </a>
          </p>
        </div>
      )}

      <div className="result-card status-expired" id="pay-expired" hidden={!finished}>
        <div className="result-icon" aria-hidden="true">
          !
        </div>
        <h1>{expired.title}</h1>
        <p className="muted">{expired.text}</p>
        <p>
          <a className="btn btn-primary" href={expired.retryHref}>
            {L['pay.retry']}
          </a>
        </p>
      </div>
    </>
  );
}
