import Logo from '../Logo.js';
import ThemeToggle from './ThemeToggle.js';

const NAV = [
  ['/', 'nav.home'],
  ['/services', 'nav.services'],
  ['/about', 'nav.about'],
  ['/contact', 'nav.contact'],
];

export default function Header({ path, t, business }) {
  const current = (href) => (path === href ? 'page' : undefined);
  return (
    <header className="site-header">
      <div className="container header-row">
        <a className="brand" href="/">
          <Logo />
          <span className="brand-name">{business.name}</span>
        </a>
        <nav className="nav-desktop" aria-label={t('nav.menu')}>
          {NAV.map(([href, key]) => (
            <a key={href} href={href} aria-current={current(href)}>
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="header-tools">
          <ThemeToggle label={t('theme.toggle')} />
        </div>
        <a className="btn btn-primary btn-sm header-cta" href="/book">
          {t('cta.book')}
        </a>
        <details className="nav-mobile">
          <summary aria-label={t('nav.menu')}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </summary>
          <nav className="nav-mobile-panel" aria-label={t('nav.menu')}>
            {NAV.map(([href, key]) => (
              <a key={href} href={href} aria-current={current(href)}>
                {t(key)}
              </a>
            ))}
            <a href="/policy" aria-current={current('/policy')}>
              {t('nav.policy')}
            </a>
          </nav>
        </details>
      </div>
    </header>
  );
}
