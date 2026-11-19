import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/public/LegalDocument';
import type { Lang } from '@/lib/i18n';
export default async function TermsPage({params}:{params:Promise<{lang:string}>}){const{lang}=await params;if(lang!=='sw'&&lang!=='en')notFound();return <LegalDocument lang={lang as Lang} slug="terms"/>}
