'use client';

import { useRef, useState, useTransition } from 'react';
import { confirmDialog } from './dialogs.js';

// A form that submits to a server action. The action either redirects (with
// ?ok=...) or returns { error } / { errors: [...] }, shown above the form; the
// fields keep what the admin typed. `confirm` asks first, in a dialog with
// `confirmLabel` on the OK button (red with `confirmDanger`).
export default function ActionForm({ action, confirm, confirmLabel = 'Тийм', confirmDanger = false, children, ...props }) {
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();
  const asking = useRef(false);
  const alertRef = useRef(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (pending || asking.current) return;
    const data = new FormData(e.currentTarget);
    if (confirm) {
      asking.current = true;
      const ok = await confirmDialog(confirm, { ok: confirmLabel, danger: confirmDanger });
      asking.current = false;
      if (!ok) return;
    }
    startTransition(async () => {
      const res = (await action(data)) || null;
      setResult(res);
      if (res) setTimeout(() => alertRef.current && alertRef.current.scrollIntoView({ block: 'nearest' }), 0);
    });
  }

  return (
    <>
      {result && result.error && (
        <div className="a-alert a-alert-err" role="alert" ref={alertRef}>
          {result.error}
        </div>
      )}
      {result && result.errors && result.errors.length > 0 && (
        <div className="a-alert a-alert-err" role="alert" ref={alertRef}>
          <ul>
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <form {...props} action={action} onSubmit={onSubmit}>
        {children}
      </form>
    </>
  );
}
