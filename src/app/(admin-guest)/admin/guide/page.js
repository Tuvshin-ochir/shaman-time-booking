import fs from 'node:fs';
import path from 'node:path';
import config from '@/config.js';
import * as settings from '@/lib/settings.js';
import * as markdown from '@/lib/markdown.js';
import { shared } from '@/lib/shared.js';
import { currentAdmin, adminMetadata } from '@/lib/admin.js';
import Logo from '@/components/Logo.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Сайт ашиглах заавар');
}

// Usage guide, rendered from docs/ADMIN_GUIDE.md. Public so it can be opened
// from the login page.
function guide() {
  const cache = shared('guide', () => ({ value: null }));
  if (!cache.value || !config.isProd) {
    cache.value = markdown.render(fs.readFileSync(path.join(process.cwd(), 'docs', 'ADMIN_GUIDE.md'), 'utf8'));
  }
  return cache.value;
}

export default async function GuidePage() {
  const loggedIn = !!(await currentAdmin());
  const { toc, html } = guide();
  return (
    <div className="guide-page">
      <header className="guide-top">
        <a className="guide-brand" href="/">
          <Logo />
          <span>{settings.get('business').name}</span>
        </a>
        <a className="a-btn" href={loggedIn ? '/admin' : '/admin/login'}>
          ← {loggedIn ? 'Админ самбар' : 'Нэвтрэх'}
        </a>
      </header>

      <div className="guide-hero">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2z" />
        </svg>
        <div>
          <h1>Сайт ашиглах заавар</h1>
          <p>Цаг захиалга, хуваарь, үнэ, нүүр хуудас, SMS-ийг админ самбараас хэрхэн удирдах вэ.</p>
        </div>
      </div>

      <div className="guide-layout">
        <details className="guide-toc" open>
          <summary>Агуулга</summary>
          <ol>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ol>
        </details>
        <article className="guide-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
