import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { LocaleSync } from '@/components/public/LocaleSync';
import { getPublicShellData } from '@/lib/public-site';
import type { Lang } from '@/lib/i18n';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{lang:string}>}){
 const {lang}=await params;if(lang!=='sw'&&lang!=='en')return{};const data=await getPublicShellData();return{title:lang==='sw'?data.settings.general.site_name_sw:data.settings.general.site_name_en,description:lang==='sw'?data.settings.general.description_sw:data.settings.general.description_en,robots:{index:data.settings.seo.robots_allow_indexing,follow:data.settings.seo.robots_allow_indexing},alternates:{languages:{sw:'/sw',en:'/en'}}};
}
export default async function PublicLayout({children,params}:{children:React.ReactNode;params:Promise<{lang:string}>}){
 const {lang:raw}=await params;if(raw!=='sw'&&raw!=='en')notFound();const lang=raw as Lang;const {settings,menus}=await getPublicShellData();
 if(settings.maintenance.enabled)return <div lang={lang} className="maintenance-page"><img src={settings.branding.institutional_logo_url} alt="TBC"/><p className="eyebrow">{lang==='sw'?'TAARIFA YA MUDA':'TEMPORARY NOTICE'}</p><h1>{lang==='sw'?settings.maintenance.message_sw:settings.maintenance.message_en}</h1><a className="public-button" href={settings.general.main_broadcast_url} target="_blank" rel="noopener noreferrer">{lang==='sw'?'Tembelea tovuti kuu ya TBC':'Visit the main TBC website'}</a></div>;
 return <div className="public-site" lang={lang}><LocaleSync/><a className="skip-link" href="#main-content">{lang==='sw'?'Ruka kwenda kwenye maudhui':'Skip to content'}</a><PublicHeader lang={lang} settings={settings} menus={menus}/><main id="main-content">{children}</main><PublicFooter lang={lang} settings={settings} menus={menus}/></div>;
}
