import '@/styles/admin.css';
import * as settings from '@/lib/settings.js';
import { requireAdmin, navBadges } from '@/lib/admin.js';
import AdminShell from '@/components/admin/AdminShell.js';
import { logout } from './admin/actions.js';

export const viewport = { width: 'device-width', initialScale: 1 };

export default async function AdminPanelLayout({ children }) {
  const admin = await requireAdmin();
  return (
    <html lang="mn">
      <body className="a-app">
        <AdminShell businessName={settings.get('business').name} username={admin.username} badges={navBadges()} logout={logout}>
          {children}
        </AdminShell>
      </body>
    </html>
  );
}
