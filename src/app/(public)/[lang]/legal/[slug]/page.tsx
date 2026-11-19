import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/public/LegalDocument';
import type { Lang } from '@/lib/i18n';
export default async function LegalPage({params}:{params:Promise<{lang:string;slug:string}>}){const{lang:raw,slug}=await params;if(raw!=='sw'&&raw!=='en')notFound();return <LegalDocument lang={raw as Lang} slug={slug}/>}
