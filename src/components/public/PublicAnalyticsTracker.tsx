'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function PublicAnalyticsTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled || !pathname || navigator.doNotTrack === '1' || !/^\/(sw|en)(?:\/|$)/.test(pathname)) return;
    const type = /\/(?:search)$/.test(pathname) ? 'search' : 'page_view';
    const language = pathname.startsWith('/en/') || pathname === '/en' ? 'en' : 'sw';
    void fetch('/api/analytics', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, path: pathname.slice(0, 240), language }),
    }).catch(() => {});
  }, [enabled, pathname]);
  return null;
}
