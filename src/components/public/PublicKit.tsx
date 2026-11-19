import Link from 'next/link';
import { ArrowRight, CalendarDays, Download, FileText, MapPin } from 'lucide-react';
import { formatDate, type Lang } from '@/lib/i18n';
import { sanitizeRichHtml } from '@/lib/security';
import type { PublicItem } from '@/lib/public-site';

export function Breadcrumbs({lang,items}:{lang:Lang;items:Array<{label:string;href?:string}>}){
 return <nav className="breadcrumbs public-container" aria-label={lang==='sw'?'Njia ya ukurasa':'Breadcrumb'}><Link href={`/${lang}`}>{lang==='sw'?'Mwanzo':'Home'}</Link>{items.map((item,index)=><span className="breadcrumb-part" key={`${item.label}-${index}`}><span className="breadcrumb-sep">/</span>{item.href?<Link href={item.href}>{item.label}</Link>:<span aria-current="page">{item.label}</span>}</span>)}</nav>
}
export function PageHeading({eyebrow,title,summary,lang}:{eyebrow:string;title:string;summary?:string;lang:Lang}){
 return <div className="public-page-heading"><div className="public-container"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{summary&&<p>{summary}</p>}<div className="heading-rule"><span/></div></div></div>
}
export function LanguageNotice({lang}:{lang:Lang}){
 return <div className="language-notice">{lang==='sw'?'Baadhi ya maudhui yanaweza kuwa hayajatafsiriwa kwa Kiingereza.':'Some material has not yet been translated into English; where necessary the available Kiswahili version is shown.'}</div>
}
export function DemoLabel({isDemo,lang}:{isDemo?:boolean;lang:Lang}){
 return isDemo?<span className="demo-label">{lang==='sw'?'Mfano wa maudhui':'Demonstration content'}</span>:null;
}
export function EmptyState({lang,title,body}:{lang:Lang;title?:string;body?:string}){
 return <div className="public-empty"><span className="empty-mark"><FileText/></span><h3>{title||(lang==='sw'?'Taarifa zinathibitishwa':'Information is being verified')}</h3><p>{body||(lang==='sw'?'Taarifa za sehemu hii zitaonekana baada ya kuthibitishwa na kuidhinishwa kwa uchapishaji na TBC.':'Information for this section will appear after verification and publication approval by TBC.')}</p></div>
}
export function ArticleCard({item,lang,href}:{item:PublicItem;lang:Lang;href:string}){
 return <article className="story-card"><Link href={href} className="story-image">{item.image?<img src={item.image} alt={item.imageAlt||''}/>:<div className="story-placeholder"><FileText/></div>}<span className="story-category">{item.category?.replaceAll('_',' ')}</span></Link><div className="story-copy"><div className="story-meta"><span>{item.date?formatDate(item.date,lang):(lang==='sw'?'Taarifa za TBC':'TBC information')}</span><span className="card-indicators"><DemoLabel isDemo={item.isDemo} lang={lang}/>{item.languageFallback&&<span className="fallback-label">{lang==='sw'?'Tafsiri haipo':'Translation pending'}</span>}</span></div><h3><Link href={href}>{item.title}</Link></h3>{item.summary&&<p>{item.summary}</p>}<Link className="text-link" href={href}>{lang==='sw'?'Soma zaidi':'Read more'}<ArrowRight size={14}/></Link></div></article>
}
export function EventCard({item,lang}:{item:PublicItem;lang:Lang}){
 return <Link className="event-card" href={`/${lang}/events/${item.slug}`}><div className="event-date"><CalendarDays/><span>{item.date?formatDate(item.date,lang):'—'}</span></div><div className="event-info"><div className="story-meta"><span>{item.category?.replaceAll('_',' ')}</span><span className="card-indicators"><DemoLabel isDemo={item.isDemo} lang={lang}/>{item.languageFallback&&<span className="fallback-label">{lang==='sw'?'Tafsiri haipo':'Translation pending'}</span>}</span></div><h3>{item.title}</h3>{item.summary&&<p>{item.summary}</p>}{item.location&&<small><MapPin size={12}/>{item.location}</small>}</div><ArrowRight className="event-arrow" size={17}/></Link>
}
export function PublicationCard({item,lang}:{item:PublicItem;lang:Lang}){
 return <article className="publication-card"><div className="pub-icon"><FileText/></div><div className="pub-copy"><div className="story-meta"><span>{item.category?.replaceAll('_',' ')}</span><span className="card-indicators"><DemoLabel isDemo={item.isDemo} lang={lang}/>{item.languageFallback&&<span className="fallback-label">{lang==='sw'?'Tafsiri haipo':'Translation pending'}</span>}</span></div><h3><Link href={`/${lang}/publications/${item.slug}`}>{item.title}</Link></h3>{item.summary&&<p>{item.summary}</p>}<div className="pub-meta">{item.reference&&<span>{lang==='sw'?'Kumb.':'Ref.'}: {item.reference}</span>}{item.date&&<span>{formatDate(item.date,lang)}</span>}</div><div className="pub-actions"><Link href={`/${lang}/publications/${item.slug}`} className="text-link">{lang==='sw'?'Taarifa zaidi':'Details'}<ArrowRight size={13}/></Link>{item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" className="download-link"><Download size={13}/>{lang==='sw'?'Pakua':'Download'}</a>}</div></div></article>
}
export function RichContent({html}:{html:string}){
 return <div className="rich-public-content" dangerouslySetInnerHTML={{__html:sanitizeRichHtml(html)}}/>;
}
export function SectionTitle({eyebrow,title,href,linkLabel,lang}:{eyebrow?:string;title:string;href?:string;linkLabel?:string;lang:Lang}){
 return <div className="section-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{href&&<Link className="text-link" href={href}>{linkLabel||(lang==='sw'?'Tazama zote':'View all')}<ArrowRight size={14}/></Link>}</div>
}
