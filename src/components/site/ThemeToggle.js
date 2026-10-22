'use client';

import { useEffect, useState } from 'react';
import { isNight, nextSunChange } from '@/lib/sun.js';

// Light/dark switch (on = dark). The choice is stored in a cookie so the server
// can render <html data-theme> directly (no flash on the next page load). The
// knob position comes from CSS, so it is right before hydration too.
const isDark = () => {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Without a choice from the switch the site is dark after sunset in
// Ulaanbaatar and follows the device setting during the day (as the server
// renders it in app/(site)/layout.js).
function applyAutoTheme() {
  if (/(?:^|;\s*)theme=(light|dark)(?:;|$)/.test(document.cookie)) return;
  const root = document.documentElement;
  if (isNight()) root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

export default function ThemeToggle({ label }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => {
      applyAutoTheme();
      setDark(isDark());
    };
    sync();
    // Catches sunrise/sunset and the end of a choice while the page stays open.
    const timer = setInterval(sync, 60000);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', sync);
    return () => {
      clearInterval(timer);
      media.removeEventListener('change', sync);
    };
  }, []);

  function toggle() {
    const next = isDark() ? 'light' : 'dark';
    // The choice lasts until the next sunrise or sunset, then the automatic theme takes over again.
    const maxAge = Math.max(60, Math.round((nextSunChange() - Date.now()) / 1000));
    document.documentElement.setAttribute('data-theme', next);
    document.cookie = `theme=${next}; path=/; max-age=${maxAge}; samesite=lax`;
    setDark(next === 'dark');
  }

  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={dark} aria-label={label} title={label} onClick={toggle}>
      <span className="theme-toggle-knob" aria-hidden="true" />
      <svg className="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
      </svg>
    </button>
  );
}
