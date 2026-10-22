import { cookies } from 'next/headers';
import { isNight } from '@/lib/sun.js';
import '@/styles/site.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: '#0b5f63',
};

export default async function SiteLayout({ children }) {
  // A choice from the theme switch lasts until the next sunrise or sunset.
  // Without one the site is dark after sunset in Ulaanbaatar and follows the
  // device setting during the day.
  const theme = (await cookies()).get('theme')?.value;
  return (
    <html lang="mn" data-theme={['light', 'dark'].includes(theme) ? theme : isNight() ? 'dark' : undefined}>
      <body>{children}</body>
    </html>
  );
}
