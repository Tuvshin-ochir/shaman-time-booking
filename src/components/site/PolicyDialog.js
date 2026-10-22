'use client';

import { useEffect, useRef, useState } from 'react';

// The cancellation policy in a dialog over the current page, so reading it
// never leaves the page. Every link to /policy opens it (plain clicks only:
// Ctrl/⌘-click still opens the page). A link with data-policy="agree", or the
// "policy:open" event with { agree: true }, opens it for agreeing: the agree
// button unlocks once the text is scrolled to the end, and pressing it sends
// the "policy:agreed" event (the booking form ticks its checkbox).
export default function PolicyDialog({ title, labels: L, children }) {
  const dialog = useRef(null);
  const body = useRef(null);
  const [agreeMode, setAgreeMode] = useState(false);
  const [progress, setProgress] = useState(0);
  const read = progress >= 100;

  function measure() {
    const el = body.current;
    if (!el) return;
    const rest = el.scrollHeight - el.clientHeight - el.scrollTop;
    // The last few pixels count as the end, so a rounding gap never blocks the button.
    const pct = rest <= 16 ? 100 : Math.min(99, Math.round((100 * (el.scrollTop + el.clientHeight)) / el.scrollHeight));
    setProgress((p) => Math.max(p, pct));
  }

  function open(agree) {
    setAgreeMode(agree);
    setProgress(0);
    if (!dialog.current.open) dialog.current.showModal();
    document.documentElement.classList.add('has-dialog');
    body.current.scrollTop = 0;
    // The text box gets the focus, so arrow keys and the space bar scroll it.
    body.current.focus();
    requestAnimationFrame(measure);
  }

  const close = () => dialog.current.close();

  function agree() {
    window.dispatchEvent(new CustomEvent('policy:agreed'));
    close();
  }

  useEffect(() => {
    const onClick = (e) => {
      const link = e.target.closest && e.target.closest('a[href="/policy"]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      // Close the phone menu the link was in.
      const menu = link.closest('details[open]');
      if (menu) menu.removeAttribute('open');
      open(link.dataset.policy === 'agree');
    };
    const onOpen = (e) => open(!!(e.detail && e.detail.agree));
    const onResize = () => dialog.current.open && measure();
    document.addEventListener('click', onClick);
    window.addEventListener('policy:open', onOpen);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('policy:open', onOpen);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={dialog}
      className="policy-dialog"
      aria-labelledby="policy-dialog-title"
      data-nosnippet
      onClose={() => document.documentElement.classList.remove('has-dialog')}
      // A click on the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="policy-dialog-box">
        <header className="policy-dialog-head">
          <h2 id="policy-dialog-title">{title}</h2>
          <button type="button" className="policy-dialog-x" aria-label={L.close} onClick={close}>
            ×
          </button>
        </header>
        <div className="policy-dialog-body" ref={body} tabIndex={0} onScroll={measure}>
          {children}
        </div>
        <footer className="policy-dialog-foot">
          {agreeMode ? (
            <>
              <div className="policy-dialog-progress">
                <progress max="100" value={progress} aria-label={L.scrollHint} />
                <p aria-live="polite">{read ? L.readDone : L.scrollHint}</p>
              </div>
              <div className="policy-dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={close}>
                  {L.close}
                </button>
                <button type="button" className="btn btn-primary" disabled={!read} onClick={agree}>
                  {L.agree}
                </button>
              </div>
            </>
          ) : (
            <div className="policy-dialog-actions">
              <button type="button" className="btn btn-primary" onClick={close}>
                {L.close}
              </button>
            </div>
          )}
        </footer>
      </div>
    </dialog>
  );
}
