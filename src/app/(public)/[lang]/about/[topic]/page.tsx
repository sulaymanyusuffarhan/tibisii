import { notFound } from 'next/navigation';
import { getPublicPage } from '@/lib/public-site';
import type { Lang } from '@/lib/i18n';
import { Breadcrumbs, EmptyState, PageHeading, RichContent } from '@/components/public/PublicKit';

const topics:Record<string,{sw:string;en:string;introSw:string;introEn:string}>={
 history:{sw:'Historia ya TBC',en:'TBC history',introSw:'Historia rasmi na hatua muhimu za taasisi zitawekwa hapa baada ya uhakiki wa kumbukumbu za TBC.',introEn:'The verified institutional history and milestones will be published here after TBC record review.'},
 mandate:{sw:'Dira, dhamira na majukumu',en:'Vision, mission and mandate',introSw:'Maelezo rasmi kuhusu dira, dhamira na majukumu ya TBC yatachapishwa baada ya idhini ya taasisi.',introEn:'The official TBC vision, mission and mandate will be published after institutional approval.'},
 vision:{sw:'Dira na dhamira',en:'Vision and mission',introSw:'Taarifa hii inasubiri uthibitisho na idhini ya TBC.',introEn:'This information is pending TBC verification and approval.'},
 structure:{sw:'Muundo wa taasisi',en:'Institutional structure',introSw:'Muundo rasmi wa sasa utawekwa hapa baada ya uthibitisho na idhini ya TBC.',introEn:'The current official organization structure will be posted after verification and TBC approval.'},
 governance:{sw:'Utawala bora',en:'Corporate governance',introSw:'Taarifa na nyaraka za utawala bora zitachapishwa kulingana na taarifa zilizoidhinishwa kwa umma.',introEn:'Governance information and documents will be published when approved for public release.'},
 board:{sw:'Bodi ya Wakurugenzi',en:'Board of Directors',introSw:'Taarifa kuhusu Bodi huwekwa baada ya idhini na uthibitisho rasmi.',introEn:'Board information is published after formal verification and approval.'},
};
export default async function AboutTopicPage({params}:{params:Promise<{lang:string;topic:string}>}){
 const {lang:raw,topic}=await params;if(raw!=='sw'&&raw!=='en')notFound();if(!topics[topic])notFound();const lang=raw as Lang;const page=await getPublicPage(topic,lang);const content=topics[topic];const title=page?.title||(lang==='sw'?content.sw:content.en);const t=(sw:string,en:string)=>lang==='sw'?sw:en;
 return <><Breadcrumbs lang={lang} items={[{label:t('Kuhusu TBC','About TBC'),href:`/${lang}/about`},{label:title}]}/><PageHeading lang={lang} eyebrow={t('TAARIFA ZA TAASISI','INSTITUTIONAL INFORMATION')} title={title} summary={page?.summary||(lang==='sw'?content.introSw:content.introEn)}/><section className="public-container content-section narrow-content">{page?.body?<RichContent html={page.body}/>:<EmptyState lang={lang} title={t('Maudhui rasmi yanatayarishwa','Verified information is pending')} body={lang==='sw'?content.introSw:content.introEn}/>}<div className="approval-note"><span>i</span><p>{t('Taarifa rasmi zitachapishwa baada ya ukaguzi na idhini ya TBC.','Official information will be published after TBC review and approval.')}</p></div></section></>;
}
