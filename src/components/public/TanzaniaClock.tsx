'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';

const FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Africa/Dar_es_Salaam',
};

export function TanzaniaClock({ lang }: { lang: Lang }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const dateTime = now?.toISOString();
  const formatted = now
    ? new Intl.DateTimeFormat(lang === 'sw' ? 'sw-TZ' : 'en-TZ', FORMAT_OPTIONS).format(now)
    : '';

  return (
    <time
      className="gov-clock"
      dateTime={dateTime}
      aria-label={lang === 'sw' ? 'Tarehe na saa za Tanzania' : 'Date and time in Tanzania'}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}
