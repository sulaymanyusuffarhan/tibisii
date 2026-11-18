import type { Metadata } from 'next';
import './globals.css';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: 'TBC Corporate CMS',
  description: 'Tanzania Broadcasting Corporation Corporate Communications content management system.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sw"><body><AdminShell>{children}</AdminShell></body></html>;
}
