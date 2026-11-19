import { getDb } from './db';
import { getNavigationMenus, getSiteSettings, type MenuItemNode, type SiteSettingsMap } from './settings';
import { pickLang, type Lang } from './i18n';

export function safePublicUrl(value:string|null|undefined):string|undefined{
 if(!value)return undefined;
 if(value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!value.split('/').includes('..'))return value;
 try{const url=new URL(value);return url.protocol==='https:'?url.toString():undefined}catch{return undefined}
}

export type PublicItem = {
  id: string; slug: string; title: string; summary: string; body?: string; category?: string;
  date?: string; image?: string; imageAlt?: string; url?: string; featured?: boolean; isDemo?: boolean;
  languageFallback?: boolean; reference?: string; fileName?: string; fileSize?: number; mimeType?: string;
  location?: string; metadata?: Record<string, unknown>;
};

const demoFilter = process.env.NODE_ENV === 'production' ? 'AND is_demo = FALSE' : '';

function fallbackMenu(lang:Lang):Record<string,MenuItemNode[]>{
 const node=(id:string,sw:string,en:string,url:string,children:MenuItemNode[]=[]):MenuItemNode=>({id,location:'main',parent_id:null,label_sw:sw,label_en:en,description_sw:'',description_en:'',url,is_external:false,open_in_new_tab:false,sort_order:0,is_visible:true,children});
 const about=node('fallback-about','Kuhusu TBC','About TBC','/about',[
  node('fallback-history','Historia yetu','Our history','/about/history'),node('fallback-mandate','Dira, dhamira na majukumu','Vision, mission and mandate','/about/mandate'),node('fallback-leadership','Uongozi','Leadership','/leadership')]);
 const services=node('fallback-services','Huduma zetu','Our services','/services',[
  node('fallback-radio','Huduma za redio','Radio services','/services/radio'),node('fallback-tv','Huduma za televisheni','Television services','/services/television'),node('fallback-digital','Huduma za kidijitali','Digital services','/services/digital')]);
 const stories=node('fallback-stories','TBC kazini','TBC at work','/stories',[
  node('fallback-behind','Nyuma ya pazia','Behind the scenes','/stories/behind-the-scenes'),node('fallback-people','Watu wa TBC','People of TBC','/people'),node('fallback-visits','Ziara na ukarimu','Visits and hospitality','/visits')]);
 const main=[about,services,stories,node('fallback-publications','Machapisho','Publications','/publications'),node('fallback-events','Matukio','Events','/events'),node('fallback-community','TBC na Jamii','TBC and community','/community')];
 const utility=[node('fallback-faq','Maswali ya mara kwa mara','Frequently asked questions','/faq'),node('fallback-contact','Wasiliana nasi','Contact us','/contact'),node('fallback-forms','Fomu za mtandaoni','Online forms','/forms')];
 const footer=(id:string,sw:string,en:string,url:string,location:string):MenuItemNode=>({...node(id,sw,en,url),location});
 return {main,utility,footer_about:[footer('fallback-footer-about','Kuhusu TBC','About TBC','/about','footer_about')],footer_services:[footer('fallback-footer-services','Huduma zetu','Our services','/services','footer_services')],footer_resources:[footer('fallback-footer-pubs','Machapisho','Publications','/publications','footer_resources'),footer('fallback-footer-events','Matukio','Events','/events','footer_resources')],footer_legal:[footer('fallback-footer-privacy','Sera ya faragha','Privacy policy','/privacy','footer_legal'),footer('fallback-footer-terms','Vigezo na masharti','Terms and conditions','/terms','footer_legal'),footer('fallback-footer-sitemap','Ramani ya tovuti','Sitemap','/sitemap','footer_legal'),footer('fallback-footer-accessibility','Upatikanaji','Accessibility','/accessibility','footer_legal')]};
}

export async function getPublicShellData(): Promise<{ settings: SiteSettingsMap; menus: Record<string, MenuItemNode[]> }> {
  const [settings, menus] = await Promise.all([getSiteSettings(), getNavigationMenus()]);
  const fallback=fallbackMenu(settings.general.default_language);
  for(const [location,items] of Object.entries(fallback)) if(!menus[location]?.length) menus[location]=items;
  if(settings.contact.verified!==true||settings.contact.is_placeholder){
    settings.contact={...settings.contact,headquarters_sw:'',headquarters_en:'',physical_address_sw:'',physical_address_en:'',building_number:'',street:'',po_box:'',phone_primary:'',phone_secondary:'',official_email:'',pr_email:'',working_hours_sw:'',working_hours_en:''};
  }
  if(settings.branding.verified!==true){
    settings.branding={...settings.branding,national_emblem_url:'',institutional_logo_url:''};
  }
  return { settings, menus };
}

export async function getHomepageSections() {
  const db = await getDb();
  const result = await db.query<{
    id:string;section_key:string;section_type:string;title_sw:string;title_en:string;subtitle_sw:string;subtitle_en:string;
    body_sw:string;body_en:string;cta_label_sw:string;cta_label_en:string;cta_url:string;image_url:string;image_alt_sw:string;image_alt_en:string;config_json:Record<string,unknown>;sort_order:number;is_demo:boolean;
  }>(`SELECT id,section_key,section_type,title_sw,title_en,subtitle_sw,subtitle_en,body_sw,body_en,cta_label_sw,cta_label_en,cta_url,image_url,image_alt_sw,image_alt_en,config_json,sort_order,is_demo
     FROM homepage_sections WHERE is_visible=TRUE ORDER BY sort_order ASC`);
  return result.rows;
}

export async function getPublicArticles(lang: Lang, options: { module?: string; limit?: number; featured?: boolean } = {}): Promise<PublicItem[]> {
  const db = await getDb();
  const values: unknown[] = [];
  const clauses = ["workflow_status='published'", "status_sw='published'"];
  if (options.module) { values.push(options.module); clauses.push(`module=$${values.length}`); }
  if (options.featured) clauses.push('is_featured=TRUE');
  values.push(options.limit ?? 20);
  const result = await db.query<{
    id:string;slug:string;title_sw:string;title_en:string;excerpt_sw:string;excerpt_en:string;body_sw:string;body_en:string;
    status_sw:string;status_en:string;category_slug:string;module:string;featured_image_url:string;featured_image_alt_sw:string;featured_image_alt_en:string;
    is_featured:boolean;is_demo:boolean;published_at:string|null;item_date:string|null;video_url:string;
  }>(`SELECT id,slug,title_sw,title_en,excerpt_sw,excerpt_en,body_sw,body_en,status_sw,status_en,category_slug,module,
            featured_image_url,featured_image_alt_sw,featured_image_alt_en,is_featured,is_demo,published_at,item_date,video_url
     FROM articles WHERE ${clauses.join(' AND ')} ${demoFilter} ORDER BY is_featured DESC,COALESCE(published_at,created_at) DESC LIMIT $${values.length}`, values);
  return result.rows.map(row => {
    const title=pickLang(lang,row.title_sw,row.title_en,row.status_sw,row.status_en);
    const summary=pickLang(lang,row.excerpt_sw,row.excerpt_en,row.status_sw,row.status_en);
    const body=pickLang(lang,row.body_sw,row.body_en,row.status_sw,row.status_en);
    return { id:row.id,slug:row.slug,title:title.text,summary:summary.text,body:body.text,category:row.module,date:row.item_date||row.published_at||undefined,
      image:safePublicUrl(row.featured_image_url),imageAlt:pickLang(lang,row.featured_image_alt_sw,row.featured_image_alt_en).text,
      featured:row.is_featured,isDemo:row.is_demo,languageFallback:title.translationUnavailable||summary.translationUnavailable||body.translationUnavailable,metadata:{module:row.module,videoUrl:row.video_url} };
  });
}

export async function getPublicArticle(slug:string,lang:Lang):Promise<PublicItem|null>{
  const list=await getPublicArticles(lang,{limit:100});
  const cached=list.find(item=>item.slug===slug);
  if(cached)return cached;
  const db=await getDb();
  const result=await db.query<{id:string;slug:string;title_sw:string;title_en:string;excerpt_sw:string;excerpt_en:string;body_sw:string;body_en:string;status_sw:string;status_en:string;module:string;category_slug:string;featured_image_url:string;featured_image_alt_sw:string;featured_image_alt_en:string;is_featured:boolean;is_demo:boolean;published_at:string|null;item_date:string|null}>(
    `SELECT id,slug,title_sw,title_en,excerpt_sw,excerpt_en,body_sw,body_en,status_sw,status_en,module,category_slug,featured_image_url,featured_image_alt_sw,featured_image_alt_en,is_featured,is_demo,published_at,item_date FROM articles WHERE slug=$1 AND workflow_status='published' AND status_sw='published' ${demoFilter} LIMIT 1`,[slug]);
  const row=result.rows[0];if(!row)return null;
  const title=pickLang(lang,row.title_sw,row.title_en,row.status_sw,row.status_en),summary=pickLang(lang,row.excerpt_sw,row.excerpt_en,row.status_sw,row.status_en),body=pickLang(lang,row.body_sw,row.body_en,row.status_sw,row.status_en);
  return {id:row.id,slug:row.slug,title:title.text,summary:summary.text,body:body.text,category:row.module,date:row.item_date||row.published_at||undefined,image:safePublicUrl(row.featured_image_url),imageAlt:pickLang(lang,row.featured_image_alt_sw,row.featured_image_alt_en).text,featured:row.is_featured,isDemo:row.is_demo,languageFallback:title.translationUnavailable||summary.translationUnavailable};
}

export async function getPublicEvents(lang:Lang,limit=20):Promise<PublicItem[]>{
 const db=await getDb();
 const result=await db.query<{id:string;slug:string;title_sw:string;title_en:string;summary_sw:string;summary_en:string;description_sw:string;description_en:string;status_sw:string;status_en:string;category_slug:string;start_date:string;end_date:string|null;location_sw:string;location_en:string;featured_image_url:string;featured_image_alt_sw:string;featured_image_alt_en:string;is_featured:boolean;is_demo:boolean}>(
  `SELECT id,slug,title_sw,title_en,summary_sw,summary_en,description_sw,description_en,status_sw,status_en,category_slug,start_date,end_date,location_sw,location_en,featured_image_url,featured_image_alt_sw,featured_image_alt_en,is_featured,is_demo FROM events WHERE workflow_status='published' AND status_sw='published' ${demoFilter} ORDER BY start_date DESC LIMIT $1`,[limit]);
 return result.rows.map(row=>{const t=pickLang(lang,row.title_sw,row.title_en,row.status_sw,row.status_en),s=pickLang(lang,row.summary_sw,row.summary_en,row.status_sw,row.status_en),b=pickLang(lang,row.description_sw,row.description_en,row.status_sw,row.status_en),loc=pickLang(lang,row.location_sw,row.location_en);return{id:row.id,slug:row.slug,title:t.text,summary:s.text,body:b.text,category:row.category_slug,date:row.start_date,image:safePublicUrl(row.featured_image_url),imageAlt:pickLang(lang,row.featured_image_alt_sw,row.featured_image_alt_en).text,featured:row.is_featured,isDemo:row.is_demo,languageFallback:t.translationUnavailable||s.translationUnavailable,location:loc.text}});
}

export async function getPublicEvent(slug:string,lang:Lang):Promise<PublicItem|null>{
 const db=await getDb();const result=await db.query<{id:string;slug:string;title_sw:string;title_en:string;summary_sw:string;summary_en:string;description_sw:string;description_en:string;status_sw:string;status_en:string;category_slug:string;start_date:string;end_date:string|null;location_sw:string;location_en:string;participants_sw:string;participants_en:string;featured_image_url:string;featured_image_alt_sw:string;featured_image_alt_en:string;gallery_json:unknown;videos_json:unknown;is_featured:boolean;is_demo:boolean}>(
 `SELECT id,slug,title_sw,title_en,summary_sw,summary_en,description_sw,description_en,status_sw,status_en,category_slug,start_date,end_date,location_sw,location_en,participants_sw,participants_en,featured_image_url,featured_image_alt_sw,featured_image_alt_en,gallery_json,videos_json,is_featured,is_demo FROM events WHERE slug=$1 AND workflow_status='published' AND status_sw='published' ${demoFilter} LIMIT 1`,[slug]);
 const row=result.rows[0];if(!row)return null;const title=pickLang(lang,row.title_sw,row.title_en,row.status_sw,row.status_en),summary=pickLang(lang,row.summary_sw,row.summary_en,row.status_sw,row.status_en),body=pickLang(lang,row.description_sw,row.description_en,row.status_sw,row.status_en);
 return{id:row.id,slug:row.slug,title:title.text,summary:summary.text,body:body.text,category:row.category_slug,date:row.start_date,image:safePublicUrl(row.featured_image_url),imageAlt:pickLang(lang,row.featured_image_alt_sw,row.featured_image_alt_en).text,location:pickLang(lang,row.location_sw,row.location_en).text,featured:row.is_featured,isDemo:row.is_demo,languageFallback:title.translationUnavailable||summary.translationUnavailable,metadata:{endDate:row.end_date,participants:pickLang(lang,row.participants_sw,row.participants_en).text,gallery:row.gallery_json,videos:row.videos_json}};
}

export async function getPublications(lang:Lang,limit=30):Promise<PublicItem[]>{
 const db=await getDb();const result=await db.query<{id:string;slug:string;title_sw:string;title_en:string;description_sw:string;description_en:string;status_sw:string;status_en:string;category_slug:string;reference_number:string;publication_date:string;document_language:string;file_url:string;file_name:string;file_size:number;mime_type:string;thumbnail_url:string;thumbnail_alt_sw:string;thumbnail_alt_en:string;is_featured:boolean;is_demo:boolean}>(
 `SELECT id,slug,title_sw,title_en,description_sw,description_en,status_sw,status_en,category_slug,reference_number,publication_date,document_language,file_url,file_name,file_size,mime_type,thumbnail_url,thumbnail_alt_sw,thumbnail_alt_en,is_featured,is_demo FROM publications WHERE workflow_status='published' AND status_sw='published' ${demoFilter} ORDER BY publication_date DESC LIMIT $1`,[limit]);
 return result.rows.map(row=>{const title=pickLang(lang,row.title_sw,row.title_en,row.status_sw,row.status_en),desc=pickLang(lang,row.description_sw,row.description_en,row.status_sw,row.status_en);return{id:row.id,slug:row.slug,title:title.text,summary:desc.text,category:row.category_slug,date:row.publication_date,image:safePublicUrl(row.thumbnail_url),imageAlt:pickLang(lang,row.thumbnail_alt_sw,row.thumbnail_alt_en).text,url:safePublicUrl(row.file_url),featured:row.is_featured,isDemo:row.is_demo,languageFallback:title.translationUnavailable||desc.translationUnavailable,reference:row.reference_number,fileName:row.file_name,fileSize:row.file_size,mimeType:row.mime_type,metadata:{documentLanguage:row.document_language}}});
}

export async function getPublicPublication(slug:string,lang:Lang):Promise<PublicItem|null>{const list=await getPublications(lang,200);return list.find(item=>item.slug===slug)||null}

export async function getPublicPage(slug:string,lang:Lang):Promise<PublicItem|null>{
 const db=await getDb();const result=await db.query<{id:string;slug:string;title_sw:string;title_en:string;summary_sw:string;summary_en:string;body_sw:string;body_en:string;status_sw:string;status_en:string;hero_image_url:string;hero_image_alt_sw:string;hero_image_alt_en:string;published_at:string|null;is_demo:boolean}>(
 `SELECT id,slug,title_sw,title_en,summary_sw,summary_en,body_sw,body_en,status_sw,status_en,hero_image_url,hero_image_alt_sw,hero_image_alt_en,published_at,is_demo FROM pages WHERE slug=$1 AND workflow_status='published' AND status_sw='published' ${demoFilter} LIMIT 1`,[slug]);
 const row=result.rows[0];if(!row)return null;const title=pickLang(lang,row.title_sw,row.title_en,row.status_sw,row.status_en),summary=pickLang(lang,row.summary_sw,row.summary_en,row.status_sw,row.status_en),body=pickLang(lang,row.body_sw,row.body_en,row.status_sw,row.status_en);return{id:row.id,slug:row.slug,title:title.text,summary:summary.text,body:body.text,date:row.published_at||undefined,image:safePublicUrl(row.hero_image_url),imageAlt:pickLang(lang,row.hero_image_alt_sw,row.hero_image_alt_en).text,isDemo:row.is_demo,languageFallback:title.translationUnavailable||summary.translationUnavailable};
}

export async function getBroadcastChannels(lang:Lang){
 const db=await getDb();const result=await db.query<{id:string;slug:string;service_type:string;name_sw:string;name_en:string;tagline_sw:string;tagline_en:string;description_sw:string;description_en:string;frequencies_json:unknown;coverage_sw:string;coverage_en:string;location_sw:string;location_en:string;distribution_platforms_json:unknown;external_url:string;image_url:string;is_demo:boolean}>(`SELECT id,slug,service_type,name_sw,name_en,tagline_sw,tagline_en,description_sw,description_en,frequencies_json,coverage_sw,coverage_en,location_sw,location_en,distribution_platforms_json,external_url,image_url,is_demo FROM broadcast_channels WHERE is_active=TRUE ${demoFilter} ORDER BY sort_order,name_sw`);
 return result.rows.map(row=>({id:row.id,slug:row.slug,type:row.service_type,name:pickLang(lang,row.name_sw,row.name_en).text,tagline:pickLang(lang,row.tagline_sw,row.tagline_en).text,description:pickLang(lang,row.description_sw,row.description_en).text,frequencies:row.frequencies_json,coverage:pickLang(lang,row.coverage_sw,row.coverage_en).text,location:pickLang(lang,row.location_sw,row.location_en).text,platforms:row.distribution_platforms_json,url:safePublicUrl(row.external_url),image:safePublicUrl(row.image_url),isDemo:row.is_demo}));
}

export async function getBroadcastSchedule(channelId:string,lang:Lang){const db=await getDb();const result=await db.query<{id:string;title_sw:string;title_en:string;description_sw:string;description_en:string;presenter_sw:string;presenter_en:string;broadcast_days:unknown;start_time:string;end_time:string;image_url:string;category_sw:string;category_en:string;language:string;is_demo:boolean}>(`SELECT id,title_sw,title_en,description_sw,description_en,presenter_sw,presenter_en,broadcast_days,start_time,end_time,image_url,category_sw,category_en,language,is_demo FROM broadcast_programmes WHERE channel_id=$1 AND workflow_status='published' ${demoFilter} ORDER BY start_time`,[channelId]);return result.rows.map(row=>({id:row.id,title:pickLang(lang,row.title_sw,row.title_en).text,description:pickLang(lang,row.description_sw,row.description_en).text,presenter:pickLang(lang,row.presenter_sw,row.presenter_en).text,days:row.broadcast_days,startTime:row.start_time,endTime:row.end_time,image:safePublicUrl(row.image_url),category:pickLang(lang,row.category_sw,row.category_en).text,language:row.language,isDemo:row.is_demo}));}

export async function getLeadership(lang:Lang){const db=await getDb();const result=await db.query<{id:string;slug:string;group_type:string;full_name:string;portrait_url:string;portrait_alt_sw:string;portrait_alt_en:string;position_sw:string;position_en:string;period_of_service:string;service_order:number;is_current:boolean;short_bio_sw:string;short_bio_en:string;is_placeholder:boolean}>(`SELECT id,slug,group_type,full_name,portrait_url,portrait_alt_sw,portrait_alt_en,position_sw,position_en,period_of_service,service_order,is_current,short_bio_sw,short_bio_en,is_placeholder FROM leadership_profiles WHERE workflow_status='published' AND status_sw='published' AND is_placeholder=FALSE ORDER BY service_order,sort_order`);return result.rows.map(r=>({id:r.id,slug:r.slug,name:r.full_name,position:pickLang(lang,r.position_sw,r.position_en).text,period:r.period_of_service,current:r.is_current,bio:pickLang(lang,r.short_bio_sw,r.short_bio_en).text,image:safePublicUrl(r.portrait_url),alt:pickLang(lang,r.portrait_alt_sw,r.portrait_alt_en).text,group:r.group_type}));}

export async function getPersonnel(lang:Lang){const db=await getDb();const result=await db.query<{id:string;slug:string;full_name:string;photo_url:string;photo_alt_sw:string;photo_alt_en:string;role_category:string;job_title_sw:string;job_title_en:string;department_sw:string;department_en:string;bio_sw:string;bio_en:string;expertise_json:unknown;programmes_json:unknown;is_featured:boolean}>(`SELECT id,slug,full_name,photo_url,photo_alt_sw,photo_alt_en,role_category,job_title_sw,job_title_en,department_sw,department_en,bio_sw,bio_en,expertise_json,programmes_json,is_featured FROM personnel_profiles WHERE workflow_status='published' AND status_sw='published' AND is_placeholder=FALSE ORDER BY is_featured DESC,sort_order,full_name`);return result.rows.map(r=>({id:r.id,slug:r.slug,name:r.full_name,role:pickLang(lang,r.job_title_sw,r.job_title_en).text,department:pickLang(lang,r.department_sw,r.department_en).text,bio:pickLang(lang,r.bio_sw,r.bio_en).text,image:safePublicUrl(r.photo_url),alt:pickLang(lang,r.photo_alt_sw,r.photo_alt_en).text,category:r.role_category,expertise:r.expertise_json,programmes:r.programmes_json,featured:r.is_featured}));}

export async function getRegionalOffices(lang:Lang){const db=await getDb();const result=await db.query<{id:string;slug:string;zone_sw:string;zone_en:string;region:string;office_name_sw:string;office_name_en:string;is_headquarters:boolean;manager_name:string;physical_address_sw:string;physical_address_en:string;building_number:string;street:string;po_box:string;telephone:string;email:string;latitude:number;longitude:number;description_sw:string;description_en:string;stations_covered_json:unknown}>(`SELECT id,slug,zone_sw,zone_en,region,office_name_sw,office_name_en,is_headquarters,manager_name,physical_address_sw,physical_address_en,building_number,street,po_box,telephone,email,latitude,longitude,description_sw,description_en,stations_covered_json FROM regional_offices WHERE is_active=TRUE AND is_placeholder=FALSE ORDER BY is_headquarters DESC,sort_order,region`);return result.rows.map(r=>({id:r.id,slug:r.slug,zone:pickLang(lang,r.zone_sw,r.zone_en).text,region:r.region,name:pickLang(lang,r.office_name_sw,r.office_name_en).text,headquarters:r.is_headquarters,manager:r.manager_name,address:pickLang(lang,r.physical_address_sw,r.physical_address_en).text,building:r.building_number,street:r.street,poBox:r.po_box,phone:r.telephone,email:r.email,latitude:r.latitude,longitude:r.longitude,description:pickLang(lang,r.description_sw,r.description_en).text,stations:r.stations_covered_json}));}

export async function getFaqs(lang:Lang){const db=await getDb();const result=await db.query<{id:string;category_sw:string;category_en:string;question_sw:string;question_en:string;answer_sw:string;answer_en:string;status_sw:string;status_en:string}>(`SELECT id,category_sw,category_en,question_sw,question_en,answer_sw,answer_en,status_sw,status_en FROM faqs WHERE is_published=TRUE AND status_sw='published' ORDER BY sort_order,created_at`);return result.rows.map(r=>({id:r.id,category:pickLang(lang,r.category_sw,r.category_en).text,question:pickLang(lang,r.question_sw,r.question_en,r.status_sw,r.status_en),answer:pickLang(lang,r.answer_sw,r.answer_en,r.status_sw,r.status_en)}));}

export async function getApprovedTestimonials(lang:Lang,limit=8){const db=await getDb();const result=await db.query<{id:string;submitter_name:string;submitter_role_or_org:string;submitter_region:string;quote_sw:string;quote_en:string;original_language:string;is_featured:boolean}>(`SELECT id,submitter_name,submitter_role_or_org,submitter_region,quote_sw,quote_en,original_language,is_featured FROM testimonials WHERE moderation_status='approved' AND is_featured=TRUE ${demoFilter} ORDER BY created_at DESC LIMIT $1`,[limit]);return result.rows.map(r=>({id:r.id,name:r.submitter_name,role:r.submitter_role_or_org,region:r.submitter_region,quote:pickLang(lang,r.quote_sw,r.quote_en).text,featured:r.is_featured}));}

export async function searchPublicContent(q:string,lang:Lang):Promise<PublicItem[]>{
 const term=q.trim().slice(0,100);if(term.length<2)return[];const like=`%${term}%`;const db=await getDb();
 const [articles,pages,events,pubs]=await Promise.all([
  db.query<{id:string;slug:string;title_sw:string;title_en:string;excerpt_sw:string;excerpt_en:string;status_sw:string;status_en:string;published_at:string|null}>(`SELECT id,slug,title_sw,title_en,excerpt_sw,excerpt_en,status_sw,status_en,published_at FROM articles WHERE workflow_status='published' AND status_sw='published' ${demoFilter} AND (title_sw ILIKE $1 OR title_en ILIKE $1 OR excerpt_sw ILIKE $1 OR excerpt_en ILIKE $1) ORDER BY published_at DESC LIMIT 10`,[like]),
  db.query<{id:string;slug:string;title_sw:string;title_en:string;summary_sw:string;summary_en:string;status_sw:string;status_en:string;published_at:string|null}>(`SELECT id,slug,title_sw,title_en,summary_sw,summary_en,status_sw,status_en,published_at FROM pages WHERE workflow_status='published' AND status_sw='published' ${demoFilter} AND (title_sw ILIKE $1 OR title_en ILIKE $1 OR summary_sw ILIKE $1 OR summary_en ILIKE $1) LIMIT 10`,[like]),
  db.query<{id:string;slug:string;title_sw:string;title_en:string;summary_sw:string;summary_en:string;status_sw:string;status_en:string;start_date:string}>(`SELECT id,slug,title_sw,title_en,summary_sw,summary_en,status_sw,status_en,start_date FROM events WHERE workflow_status='published' AND status_sw='published' ${demoFilter} AND (title_sw ILIKE $1 OR title_en ILIKE $1 OR summary_sw ILIKE $1 OR summary_en ILIKE $1) ORDER BY start_date DESC LIMIT 10`,[like]),
  db.query<{id:string;slug:string;title_sw:string;title_en:string;description_sw:string;description_en:string;status_sw:string;status_en:string;publication_date:string;file_url:string}>(`SELECT id,slug,title_sw,title_en,description_sw,description_en,status_sw,status_en,publication_date,file_url FROM publications WHERE workflow_status='published' AND status_sw='published' ${demoFilter} AND (title_sw ILIKE $1 OR title_en ILIKE $1 OR description_sw ILIKE $1 OR description_en ILIKE $1 OR file_name ILIKE $1 OR reference_number ILIKE $1) ORDER BY publication_date DESC LIMIT 10`,[like])
 ]);
 const output:PublicItem[]=[];
 for(const r of articles.rows){const t=pickLang(lang,r.title_sw,r.title_en,r.status_sw,r.status_en),s=pickLang(lang,r.excerpt_sw,r.excerpt_en,r.status_sw,r.status_en);output.push({id:r.id,slug:r.slug,title:t.text,summary:s.text,date:r.published_at||undefined,category:'article',url:`/${lang}/stories/${r.slug}`})}
 for(const r of pages.rows){const t=pickLang(lang,r.title_sw,r.title_en,r.status_sw,r.status_en),s=pickLang(lang,r.summary_sw,r.summary_en,r.status_sw,r.status_en);output.push({id:r.id,slug:r.slug,title:t.text,summary:s.text,date:r.published_at||undefined,category:'page',url:`/${lang}/page/${r.slug}`})}
 for(const r of events.rows){const t=pickLang(lang,r.title_sw,r.title_en,r.status_sw,r.status_en),s=pickLang(lang,r.summary_sw,r.summary_en,r.status_sw,r.status_en);output.push({id:r.id,slug:r.slug,title:t.text,summary:s.text,date:r.start_date,category:'event',url:`/${lang}/events/${r.slug}`})}
 for(const r of pubs.rows){const t=pickLang(lang,r.title_sw,r.title_en,r.status_sw,r.status_en),s=pickLang(lang,r.description_sw,r.description_en,r.status_sw,r.status_en);output.push({id:r.id,slug:r.slug,title:t.text,summary:s.text,date:r.publication_date,category:'publication',url:`/${lang}/publications/${r.slug}`})}
 return output.slice(0,40);
}
