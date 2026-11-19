import Link from 'next/link';
import { ChevronDown, ExternalLink, Search } from 'lucide-react';
import type { MenuItemNode, SiteSettingsMap } from '@/lib/settings';
import type { Lang } from '@/lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { TanzaniaClock } from './TanzaniaClock';

function localizedHref(url:string,lang:Lang){if(/^https?:\/\//i.test(url)||url.startsWith('mailto:')||url.startsWith('tel:'))return url;const clean=url.startsWith('/')?url:`/${url}`;return `/${lang}${clean==='/'?'':clean}`}
function MenuBranch({item,lang}:{item:MenuItemNode;lang:Lang}){
 const href=localizedHref(item.url,lang);
 return <li className={item.children.length?'has-dropdown':''}>
   <Link href={href} target={item.open_in_new_tab?'_blank':undefined} rel={item.is_external?'noopener noreferrer':undefined}>{lang==='sw'?item.label_sw:item.label_en}{item.is_external&&<ExternalLink size={11}/>}</Link>
   {item.children.length>0&&<><details className="nav-mobile-children"><summary><ChevronDown size={14}/></summary><ul>{item.children.map(child=><MenuBranch item={child} lang={lang} key={child.id}/>)}</ul></details><div className="nav-dropdown"><div className="dropdown-kicker">{lang==='sw'?'GUNDUA ZAIDI':'EXPLORE'}</div>{item.children.map(child=><Link href={localizedHref(child.url,lang)} key={child.id}><span>{lang==='sw'?child.label_sw:child.label_en}</span><small>{lang==='sw'?child.description_sw:child.description_en}</small></Link>)}</div></>}
 </li>
}

export function PublicHeader({lang,settings,menus}:{lang:Lang;settings:SiteSettingsMap;menus:Record<string,MenuItemNode[]>}){
 const main=(menus.main||[]).filter(item=>item.url!=='/'&&item.url!==`/${lang}`);const utility=menus.utility||[];
 const homeLabel=lang==='sw'?'Mwanzo':'Home';
 const emblem=settings.branding.national_emblem_url||'/branding/tanzania-emblem.png';
 const logo=settings.branding.institutional_logo_url||'/branding/tbc-logo.webp';
 return <>
  <div className="gov-strip"><div className="public-container gov-inner"><TanzaniaClock lang={lang}/><div className="gov-tools"><div className="gov-links">{utility.map(item=><Link key={item.id} href={localizedHref(item.url,lang)}>{lang==='sw'?item.label_sw:item.label_en}</Link>)}<a href={settings.general.main_broadcast_url} target="_blank" rel="noopener noreferrer">{lang==='sw'?'Tovuti kuu ya TBC':'Main TBC website'} <ExternalLink size={10}/></a></div><LanguageSwitcher lang={lang}/></div></div></div>
  <header className="public-header">
   <div className="public-container masthead">
    <Link href={`/${lang}`} className="mast-emblem"><img src={emblem} alt={lang==='sw'?'Nembo ya Taifa la Tanzania':'National Emblem of Tanzania'}/></Link>
    <Link href={`/${lang}`} className="mast-brand"><small>{lang==='sw'?settings.general.government_header_sw:settings.general.government_header_en}</small><strong>{lang==='sw'?settings.general.institution_name_sw:settings.general.institution_name_en}</strong></Link>
    <div className="mast-actions"><Link href={`/${lang}`} className="mast-logo-link"><img className="mast-logo" src={logo} alt={lang==='sw'?'Nembo rasmi ya TBC':'Official TBC logo'}/></Link></div>
   </div>
   <div className="nav-band"><div className="public-container nav-wrap"><nav className="primary-nav" aria-label={lang==='sw'?'Menyu kuu':'Main navigation'}><ul><li><Link href={`/${lang}`}>{homeLabel}</Link></li>{main.map(item=><MenuBranch item={item} lang={lang} key={item.id}/>)}</ul></nav><form className="public-search" action={`/${lang}/search`} method="get"><label className="sr-only" htmlFor="site-search">{lang==='sw'?'Tafuta tovuti':'Search website'}</label><Search size={15}/><input id="site-search" name="q" placeholder={lang==='sw'?'Tafuta…':'Search…'} maxLength={100}/><button type="submit" aria-label={lang==='sw'?'Tafuta':'Search'}><Search size={13}/></button></form><details className="mobile-nav"><summary><span className="hamburger"><i/><i/><i/></span><span>{lang==='sw'?'Menyu':'Menu'}</span></summary><div className="mobile-menu-panel"><form action={`/${lang}/search`} method="get"><input name="q" placeholder={lang==='sw'?'Tafuta tovuti':'Search website'}/><button><Search size={14}/></button></form><ul><li><Link href={`/${lang}`}>{homeLabel}</Link></li>{main.map(item=><MenuBranch item={item} lang={lang} key={item.id}/>)}</ul><div className="mobile-utility">{utility.map(item=><Link key={item.id} href={localizedHref(item.url,lang)}>{lang==='sw'?item.label_sw:item.label_en}</Link>)}</div></div></details></div></div>
  </header>
  {settings.general.show_demo_banner&&<div className="demo-ribbon"><div className="public-container">{lang==='sw'?'Tovuti ya majaribio — taarifa na nyaraka zitawekwa baada ya uhakiki na idhini ya TBC.':'Staging portal — institutional information and documents are subject to TBC verification and approval.'}</div></div>}
 </>
}
