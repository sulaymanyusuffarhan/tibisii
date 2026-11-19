import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Tanzania Broadcasting Corporation (TBC)', template: '%s | TBC' },
  description: 'Tanzania Broadcasting Corporation corporate communication portal.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const language = requestHeaders.get('x-locale') === 'en' ? 'en' : 'sw';
  return <html lang={language}><body>{children}</body></html>;
}
