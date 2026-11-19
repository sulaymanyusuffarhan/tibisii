'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export function LocaleSync(){const path=usePathname();useEffect(()=>{const locale=path.split('/')[1];document.documentElement.lang=locale==='en'?'en':'sw'},[path]);return null}
