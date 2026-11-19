'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Lang } from '@/lib/i18n';
export function LanguageSwitcher({lang}:{lang:Lang}){
 const pathname=usePathname();const other:Lang=lang==='sw'?'en':'sw';
 const parts=pathname.split('/');parts[1]=other;const href=parts.join('/')||`/${other}`;
 return <Link className="language-toggle" href={href} hrefLang={other} aria-label={lang==='sw'?'Switch to English':'Badili kwenda Kiswahili'}><span>{lang==='sw'?'SW':'EN'}</span><span className="lang-divider">/</span><span className="lang-other">{other.toUpperCase()}</span></Link>;
}
