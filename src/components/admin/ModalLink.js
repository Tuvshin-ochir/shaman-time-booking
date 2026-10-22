'use client';

import { useId, useRef } from 'react';

// A link that opens `content` (a form, or details to look at) in a dialog
// instead of going to its own page. The page still works on its own (new tab,
// or a click before the script has loaded). A successful save redirects and
// re-renders the page; give this a `key` that changes on every render so the
// dialog then starts closed and empty. `wide` is for big forms (the news editor).
export default function ModalLink({ href, title, className, content, wide = false, children }) {
  const dialog = useRef(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  function open(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    dialog.current.showModal();
    dialog.current.querySelector('.a-modal-body :is(input:not([type="hidden"]), select, textarea)')?.focus();
  }

  const close = () => dialog.current.close();

  return (
    <>
      <a className={className} href={href} onClick={open}>
        {children}
      </a>
      {/* A click that starts and ends on the backdrop closes the dialog (not a text selection dragged out of it). */}
      <dialog
        ref={dialog}
        className={`a-modal${wide ? ' a-modal-wide' : ''}`}
        aria-labelledby={titleId}
        onMouseDown={(e) => (pressedOnBackdrop.current = e.target === e.currentTarget)}
        onClick={(e) => pressedOnBackdrop.current && e.target === e.currentTarget && close()}
      >
        <div className="a-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="a-modal-close" aria-label="Хаах" onClick={close}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="a-modal-body">{content}</div>
      </dialog>
    </>
  );
}
