import { redirect } from 'next/navigation';
import * as settings from '@/lib/settings.js';
import { currentAdmin, adminMetadata, field } from '@/lib/admin.js';
import ActionForm from '@/components/admin/ActionForm.js';
import Logo from '@/components/Logo.js';
import { login } from './actions.js';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return adminMetadata('Нэвтрэх');
}

export default async function LoginPage({ searchParams }) {
  if (await currentAdmin()) redirect('/admin');
  const { next } = await searchParams;
  return (
    <div className="a-login">
      <div className="a-card">
        <div className="a-login-brand">
          <Logo />
          <strong>{settings.get('business').name}</strong>
        </div>
        <h1>Админ нэвтрэх</h1>
        <ActionForm action={login} className="a-form">
          <input type="hidden" name="next" value={field(next)} />
          <label>
            Нэвтрэх нэр
            <input name="username" autoComplete="username" required autoFocus />
          </label>
          <label>
            Нууц үг
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="a-btn a-btn-primary a-btn-block" type="submit">
            Нэвтрэх
          </button>
        </ActionForm>
        <a className="a-btn a-btn-block guide-link" href="/admin/guide">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2z" />
          </svg>{' '}
          Сайт ашиглах заавар
        </a>
      </div>
    </div>
  );
}
