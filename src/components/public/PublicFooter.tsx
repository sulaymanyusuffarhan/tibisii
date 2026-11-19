import Link from 'next/link';
import { ArrowUpRight, ExternalLink, MapPin, Mail, Phone } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import type { MenuItemNode, SiteSettingsMap } from '@/lib/settings';

function hrefFor(url:string,lang:Lang){if(/^https?:\/\//i.test(url)||/^(mailto:|tel:)/i.test(url))return url;return `/${lang}${url.startsWith('/')?url:`/${url}`}`}
export function PublicFooter({lang,settings,menus}:{lang:Lang;settings:SiteSettingsMap;menus:Record<string,MenuItemNode[]>}){
 const address=lang==='sw'?settings.contact.physical_address_sw:settings.contact.physical_address_en;
 const verifiedContact=settings.contact.verified===true&&!settings.contact.is_placeholder;
 return <footer className="public-footer">
  <div className="footer-main"><div className="public-container footer-grid">
   <div className="footer-brand"><img src={settings.branding.institutional_logo_url||'/branding/tbc-logo.webp'} alt="TBC"/><h2>{lang==='sw'?settings.general.institution_name_sw:settings.general.institution_name_en}</h2><p>{lang==='sw'?settings.footer.about_blurb_sw:settings.footer.about_blurb_en}</p><a className="footer-external" href={settings.general.main_broadcast_url} target="_blank" rel="noopener noreferrer">{lang==='sw'?'Tembelea tovuti kuu ya TBC':'Visit the main TBC website'} <ArrowUpRight size={13}/></a></div>
   <div className="footer-links"><h3>{lang==='sw'?'Kuhusu TBC':'About TBC'}</h3>{(menus.footer_about||[]).map(item=><Link key={item.id} href={hrefFor(item.url,lang)}>{lang==='sw'?item.label_sw:item.label_en}</Link>)}<Link href={`/${lang}/leadership`}>{lang==='sw'?'Uongozi':'Leadership'}</Link><Link href={`/${lang}/offices`}>{lang==='sw'?'Ofisi za kanda':'Regional offices'}</Link></div>
   <div className="footer-links"><h3>{lang==='sw'?'Rasilimali':'Resources'}</h3>{(menus.footer_resources||[]).map(item=><Link key={item.id} href={hrefFor(item.url,lang)}>{lang==='sw'?item.label_sw:item.label_en}</Link>)}<Link href={`/${lang}/faq`}>{lang==='sw'?'Maswali yanayoulizwa mara kwa mara':'Frequently asked questions'}</Link><Link href={`/${lang}/forms`}>{lang==='sw'?'Fomu za mtandaoni':'Online forms'}</Link><Link href={`/${lang}/sitemap`}>{lang==='sw'?'Ramani ya tovuti':'Sitemap'}</Link></div>
   <div className="footer-contact"><h3>{lang==='sw'?'Mawasiliano':'Contact'}</h3>{verifiedContact?<>{address&&<p><MapPin size={14}/><span>{address}</span></p>}{settings.contact.phone_primary&&<p><Phone size={14}/><span>{settings.contact.phone_primary}</span></p>}{settings.contact.official_email&&<p><Mail size={14}/><span>{settings.contact.official_email}</span></p>}</>:<p className="contact-pending">{lang==='sw'?'Taarifa za mawasiliano zinathibitishwa.':'Contact details are pending verification.'}</p>}{settings.contact.emrejesho_enabled&&<a className="footer-emrejesho" href={settings.contact.emrejesho_url} target="_blank" rel="noopener noreferrer">e-Mrejesho <ExternalLink size={11}/></a>}</div>
  </div></div>
  <div className="footer-bottom"><div className="public-container footer-bottom-inner"><span>{lang==='sw'?settings.footer.copyright_sw:settings.footer.copyright_en}</span><div><Link href={`/${lang}/privacy`}>{lang==='sw'?'Faragha':'Privacy'}</Link><Link href={`/${lang}/terms`}>{lang==='sw'?'Vigezo':'Terms'}</Link><Link href={`/${lang}/disclaimer`}>{lang==='sw'?'Kanusho':'Disclaimer'}</Link><Link href={`/${lang}/accessibility`}>{lang==='sw'?'Upatikanaji':'Accessibility'}</Link></div></div></div>
 </footer>
}
