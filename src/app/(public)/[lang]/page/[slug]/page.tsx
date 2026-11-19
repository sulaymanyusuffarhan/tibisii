import { notFound } from 'next/navigation';
import { getPublicPage } from '@/lib/public-site';
import { Breadcrumbs, DemoLabel, LanguageNotice, PageHeading, RichContent } from '@/components/public/PublicKit';
import type { Lang } from '@/lib/i18n';
export default async function CmsPage({params}:{params:Promise<{lang:string;slug:string}>}){
 const {lang:raw,slug}=await params;if(raw!=='sw'&&raw!=='en')notFound();const lang=raw as Lang;const page=await getPublicPage(slug,lang);if(!page)notFound();const t=(sw:string,en:string)=>lang==='sw'?sw:en;
 return <><Breadcrumbs lang={lang} items={[{label:t('Taarifa','Information')},{label:page.title}]}/><PageHeading lang={lang} eyebrow={t('TAARIFA ZA TBC','TBC INFORMATION')} title={page.title} summary={page.summary}/><section className="public-container content-section narrow-content"><div className="page-meta"><span>{page.date?new Date(page.date).toLocaleDateString(lang==='sw'?'sw-TZ':'en-TZ'):'TBC'}</span><DemoLabel isDemo={page.isDemo} lang={lang}/></div>{page.languageFallback&&<LanguageNotice lang={lang} />}{page.body&&<RichContent html={page.body}/>}</section></>;
}
