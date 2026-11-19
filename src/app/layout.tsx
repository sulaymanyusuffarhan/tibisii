import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Tanzania Broadcasting Corporation (TBC)', template: '%s | TBC' },
  description: 'Tanzania Broadcasting Corporation corporate communication portal.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sw"><body>{children}</body></html>;
}
