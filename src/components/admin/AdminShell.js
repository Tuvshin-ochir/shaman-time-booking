'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Logo from '../Logo.js';
import Icon from './icons.js';
import { MESSAGES, ERRORS } from '@/lib/admin-messages.js';

const GROUPS = [
  ['Ажил', [['dashboard', '/admin', 'Самбар'], ['bookings', '/admin/bookings', 'Захиалга'], ['schedule', '/admin/schedule', 'Хуваарь']]],
  ['Сайт', [['landing', '/admin/landing', 'Нүүр хуудас'], ['news', '/admin/news', 'Мэдээ'], ['services', '/admin/services', 'Үйлчилгээ ба үнэ']]],
  ['Систем', [['payments', '/admin/payments', 'Төлбөр'], ['sms', '/admin/sms', 'SMS'], ['settings', '/admin/settings', 'Тохиргоо']]],
];

function sectionOf(path) {
  if (path === '/admin') return 'dashboard';
  for (const [, items] of GROUPS) for (const [key, href] of items) if (href !== '/admin' && path.startsWith(href)) return key;
  return null;
}

// ?ok=... / ?err=... messages after an action.
function Flash() {
  const query = useSearchParams();
  const ok = MESSAGES[query.get('ok')];
  const err = ERRORS[query.get('err')];
  return (
    <>
      {ok && (
        <div className="a-alert a-alert-ok" role="status">
          {ok}
        </div>
      )}
      {err && (
        <div className="a-alert a-alert-err" role="alert">
          {err}
        </div>
      )}
    </>
  );
}

// Sidebar (a drawer on small screens), top bar and page area.
export default function AdminShell({ businessName, username, badges, logout, children }) {
  const section = sectionOf(usePathname());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('nav-open', open);
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <aside className="a-sidebar" id="a-sidebar" aria-label="Админ цэс">
        <a className="a-brand" href="/admin">
          <Logo />
          <span>{businessName}</span>
        </a>
        <nav className="a-side-nav">
          {GROUPS.map(([title, items]) => (
            <Fragment key={title}>
              <p className="a-nav-group">{title}</p>
              {items.map(([key, href, label]) => (
                <a key={key} href={href} aria-current={section === key ? 'page' : undefined}>
                  <Icon name={key} />
                  <span>{label}</span>
                  {badges[key] > 0 && (
                    <span className="a-badge" title="Анхаарах зүйл">
                      {badges[key]}
                    </span>
                  )}
                </a>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="a-side-foot">
          <a href="/" target="_blank" rel="noopener">
            <Icon name="external" />
            <span>Сайт үзэх</span>
          </a>
          <form action={logout}>
            <button type="submit">
              <Icon name="logout" />
              <span>
                Гарах <small>({username})</small>
              </span>
            </button>
          </form>
        </div>
      </aside>
      <div className="a-backdrop" data-nav-close hidden={!open} onClick={() => setOpen(false)}></div>
      <div className="a-page">
        <header className="a-topbar">
          <button
            type="button"
            className="a-menu-btn"
            data-nav-toggle
            aria-controls="a-sidebar"
            aria-expanded={open ? 'true' : 'false'}
            aria-label="Цэс нээх"
            onClick={() => setOpen(!open)}
          >
            <Icon name="menu" />
          </button>
          <a className="a-brand a-brand-top" href="/admin">
            <Logo />
            <span>{businessName}</span>
          </a>
        </header>
        <main className="a-main">
          <Suspense>
            <Flash />
          </Suspense>
          {children}
        </main>
      </div>
    </>
  );
}
