import Logo from '../Logo.js';
import { telHref } from '@/lib/site.js';

export default function Footer({ t, business }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <a className="brand brand-footer" href="/">
            <Logo />
            <span className="brand-name">{business.name}</span>
          </a>
          <p className="muted">{business.tagline}</p>
        </div>
        <div>
          <p className="footer-title">{t('contact.title')}</p>
          <ul className="footer-list">
            <li>
              <a href={telHref(business.phone)}>{business.phone}</a>
            </li>
            {business.email && (
              <li>
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </li>
            )}
            <li className="muted">{business.address}</li>
            {business.facebook_url && (
              <li>
                <a href={business.facebook_url} rel="noopener" target="_blank">
                  {t('contact.facebook')}
                </a>
              </li>
            )}
          </ul>
        </div>
        <div>
          <ul className="footer-list">
            <li>
              <a href="/services">{t('nav.services')}</a>
            </li>
            <li>
              <a href="/about">{t('nav.about')}</a>
            </li>
            <li>
              <a href="/policy">{t('nav.policy')}</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {business.name}
        </span>
        <span className="secure-note">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 10V8a6 6 0 1112 0v2m-13 0h14v11H5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>{' '}
          {t('footer.secure')}
        </span>
      </div>
    </footer>
  );
}
