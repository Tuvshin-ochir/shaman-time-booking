import '@/styles/admin.css';

export const viewport = { width: 'device-width', initialScale: 1 };

// Login and usage guide: admin styles without the sidebar.
export default function AdminGuestLayout({ children }) {
  return (
    <html lang="mn">
      <body className="a-guest">
        <main className="a-main">{children}</main>
      </body>
    </html>
  );
}
