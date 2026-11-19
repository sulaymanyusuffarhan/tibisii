import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import './brand-overrides.css';
export const metadata: Metadata = {
  title: { default: 'Tanzania Broadcasting Corporation (TBC)', template: '%s | TBC' },
  description: 'Tanzania Broadcasting Corporation corporate communication portal.',
  icons: {
    icon: '/branding/tbc-logo.webp',
    apple: '/branding/tbc-logo.webp',
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const language = requestHeaders.get('x-locale') === 'en' ? 'en' : 'sw';
  return <html lang={language}><body>{children}</body></html>;
}
