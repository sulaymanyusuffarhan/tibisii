import type { DbAdapter } from './db';
import { DEFAULT_ROLES } from './permissions';
import { DEFAULT_SITE_SETTINGS } from './settings';
import { createId } from './security';

/** Seed only non-personal, replaceable system configuration. Admin accounts are bootstrapped separately. */
export async function seedDatabase(db: DbAdapter): Promise<void> {
  await db.transaction(async (tx) => {
    for (const role of DEFAULT_ROLES) {
      await tx.query(
        `INSERT INTO roles (id, slug, name_sw, name_en, description_sw, description_en, permissions, is_system)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
         ON CONFLICT (slug) DO NOTHING`,
        [
          role.id,
          role.slug,
          role.name_sw,
          role.name_en,
          role.description_sw,
          role.description_en,
          JSON.stringify(role.permissions),
          role.is_system,
        ]
      );
    }

    for (const [key, value] of Object.entries(DEFAULT_SITE_SETTINGS)) {
      await tx.query(
        `INSERT INTO site_settings (key, value_json, group_name)
         VALUES ($1, $2::jsonb, $1) ON CONFLICT (key) DO NOTHING`,
        [key, JSON.stringify(value)]
      );
    }

    const categories = [
      ['press-release', 'publication', 'Taarifa kwa Vyombo vya Habari', 'Press Releases'],
      ['annual-report', 'publication', 'Ripoti za Mwaka', 'Annual Reports'],
      ['policy', 'publication', 'Sera na Miongozo', 'Policies & Guidelines'],
      ['corporate-activity', 'event', 'Shughuli za Shirika', 'Corporate Activities'],
      ['announcement', 'article', 'Matangazo ya Taasisi', 'Institutional Announcements'],
      ['behind-scenes', 'article', 'Nyuma ya Pazia', 'Behind the Scenes'],
    ];
    for (const [slug, module, sw, en] of categories) {
      await tx.query(
        `INSERT INTO categories (id, slug, module, name_sw, name_en)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (module, slug) DO NOTHING`,
        [createId('cat'), slug, module, sw, en]
      );
    }

    const menu = [
      ['menu_main_about','main',null,'Kuhusu TBC','About TBC','Taarifa kuhusu taasisi','Institutional information','/about',0],
      ['menu_about_history','main','menu_main_about','Historia yetu','Our history','','','/about/history',1],
      ['menu_about_mandate','main','menu_main_about','Dira, dhamira na majukumu','Vision, mission and mandate','','','/about/mandate',2],
      ['menu_about_leadership','main','menu_main_about','Uongozi','Leadership','','','/leadership',3],
      ['menu_main_services','main',null,'Huduma zetu','Our services','','','/services',1],
      ['menu_services_radio','main','menu_main_services','Huduma za redio','Radio services','','','/services/radio',1],
      ['menu_services_tv','main','menu_main_services','Huduma za televisheni','Television services','','','/services/television',2],
      ['menu_services_digital','main','menu_main_services','Huduma za kidijitali','Digital services','','','/services/digital',3],
      ['menu_main_stories','main',null,'TBC kazini','TBC at work','','','/stories',2],
      ['menu_stories_behind','main','menu_main_stories','Nyuma ya pazia','Behind the scenes','','','/stories/behind-the-scenes',1],
      ['menu_stories_people','main','menu_main_stories','Watu wa TBC','People of TBC','','','/people',2],
      ['menu_stories_visits','main','menu_main_stories','Ziara na ukarimu','Visits and hospitality','','','/visits',3],
      ['menu_main_publications','main',null,'Machapisho','Publications','','','/publications',3],
      ['menu_main_events','main',null,'Matukio','Events','','','/events',4],
      ['menu_main_community','main',null,'TBC na Jamii','TBC and community','','','/community',5],
      ['menu_utility_faq','utility',null,'Maswali ya mara kwa mara','Frequently asked questions','','','/faq',0],
      ['menu_utility_contact','utility',null,'Wasiliana nasi','Contact us','','','/contact',1],
      ['menu_utility_forms','utility',null,'Fomu za mtandaoni','Online forms','','','/forms',2],
      ['menu_footer_about','footer_about',null,'Kuhusu TBC','About TBC','','','/about',0],
      ['menu_footer_services','footer_services',null,'Huduma zetu','Our services','','','/services',0],
      ['menu_footer_publications','footer_resources',null,'Machapisho','Publications','','','/publications',0],
      ['menu_footer_events','footer_resources',null,'Matukio','Events','','','/events',1],
      ['menu_footer_privacy','footer_legal',null,'Sera ya faragha','Privacy policy','','','/privacy',0],
      ['menu_footer_terms','footer_legal',null,'Vigezo na masharti','Terms and conditions','','','/terms',1],
      ['menu_footer_sitemap','footer_legal',null,'Ramani ya tovuti','Sitemap','','','/sitemap',2],
      ['menu_footer_accessibility','footer_legal',null,'Upatikanaji','Accessibility','','','/accessibility',3],
    ] as const;
    for (const [id, location, parentId, labelSw, labelEn, descriptionSw, descriptionEn, url, sortOrder] of menu) {
      await tx.query(
        `INSERT INTO menu_items (id,location,parent_id,label_sw,label_en,description_sw,description_en,url,sort_order,is_visible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) ON CONFLICT (id) DO NOTHING`,
        [id,location,parentId,labelSw,labelEn,descriptionSw,descriptionEn,url,sortOrder]
      );
    }

    const sections = [
      { id:'home_hero',key:'hero',type:'hero',titleSw:'Mawasiliano ya taasisi, huduma kwa umma',titleEn:'Institutional communication. Public service.',subtitleSw:'Shirika la Utangazaji Tanzania',subtitleEn:'Tanzania Broadcasting Corporation',bodySw:'Karibu kwenye tovuti ya mawasiliano ya Shirika la Utangazaji Tanzania (TBC). Pata taarifa kuhusu utambulisho wa taasisi, huduma, machapisho na shughuli za wadau.',bodyEn:'Welcome to the corporate communication portal of the Tanzania Broadcasting Corporation (TBC). Explore institutional information, services, publications and stakeholder engagement.',ctaSw:'Kuhusu TBC',ctaEn:'About TBC',url:'/about',image:'/media/images/hero-broadcast-center.jpg',altSw:'Kituo cha utangazaji cha TBC',altEn:'A TBC broadcasting facility',order:0 },
      { id:'home_intro',key:'introduction',type:'intro',titleSw:'TBC ni taasisi ya utangazaji wa umma',titleEn:'TBC is a public broadcasting institution',subtitleSw:'Utambulisho wa taasisi',subtitleEn:'Institutional profile',bodySw:'Tovuti hii inaangazia utambulisho, taarifa za taasisi, huduma, machapisho na shughuli za Shirika. Kwa habari na matangazo, tembelea tovuti kuu ya TBC.',bodyEn:'This portal focuses on institutional identity, public information, services, publications and corporate activities. For news and broadcasts, visit the main TBC website.',ctaSw:'Soma kuhusu taasisi',ctaEn:'Explore the institution',url:'/about',image:'/media/images/headquarters-architecture.jpg',altSw:'Jengo la taasisi',altEn:'Institutional building',order:1 },
      { id:'home_services',key:'services',type:'service_links',titleSw:'Huduma za utangazaji',titleEn:'Broadcasting services',subtitleSw:'Redio, televisheni na mifumo ya kidijitali',subtitleEn:'Radio, television and digital platforms',bodySw:'Taarifa za huduma na ratiba huchapishwa hapa baada ya kuthibitishwa na TBC.',bodyEn:'Service details and schedules are published here after verification by TBC.',ctaSw:'Tazama huduma',ctaEn:'Explore services',url:'/services',image:'/media/images/radio-studio-session.jpg',altSw:'Studio ya redio',altEn:'Radio studio',order:2 },
      { id:'home_events',key:'events',type:'events',titleSw:'Shughuli za taasisi',titleEn:'Institutional activities',subtitleSw:'Ziara, mikutano na matukio',subtitleEn:'Visits, meetings and events',bodySw:'Matukio yaliyothibitishwa yataonekana katika sehemu hii.',bodyEn:'Verified events and institutional activities will appear here.',ctaSw:'Matukio yote',ctaEn:'All events',url:'/events',image:'/media/images/corporate-conference-visit.jpg',altSw:'Mkutano wa kitaasisi',altEn:'Institutional meeting',order:3 },
      { id:'home_publications',key:'publications',type:'publications',titleSw:'Machapisho na taarifa',titleEn:'Publications and information',subtitleSw:'Nyaraka zilizoidhinishwa',subtitleEn:'Approved public documents',bodySw:'Nyaraka zitawekwa baada ya uhakiki na idhini ya uchapishaji.',bodyEn:'Documents appear here after review and publication approval.',ctaSw:'Maktaba ya machapisho',ctaEn:'Browse publications',url:'/publications',image:'/media/images/transmission-infrastructure.jpg',altSw:'Miundombinu ya utangazaji',altEn:'Broadcasting infrastructure',order:4 },
    ];
    for (const section of sections) {
      await tx.query(
        `INSERT INTO homepage_sections (id,section_key,section_type,title_sw,title_en,subtitle_sw,subtitle_en,body_sw,body_en,cta_label_sw,cta_label_en,cta_url,image_url,image_alt_sw,image_alt_en,sort_order,is_visible,is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,FALSE)
         ON CONFLICT (id) DO NOTHING`,
        [section.id,section.key,section.type,section.titleSw,section.titleEn,section.subtitleSw,section.subtitleEn,section.bodySw,section.bodyEn,section.ctaSw,section.ctaEn,section.url,section.image,section.altSw,section.altEn,section.order]
      );
    }
  });
}
