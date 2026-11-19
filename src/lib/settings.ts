import { getDb } from './db';
import type { WorkflowRules } from './permissions';

export interface SiteSettingsMap {
  general: {
    site_name_sw: string;
    site_name_en: string;
    institution_name_sw: string;
    institution_name_en: string;
    government_header_sw: string;
    government_header_en: string;
    tagline_sw: string;
    tagline_en: string;
    description_sw: string;
    description_en: string;
    main_broadcast_url: string;
    default_language: 'sw' | 'en';
    available_languages: string[];
    show_demo_banner: boolean;
  };
  branding: {
    national_emblem_url: string;
    institutional_logo_url: string;
    verified: boolean;
    emblem_placement: 'left_right' | 'top_centered' | 'emblem_left_only';
    branding_notice_sw: string;
    branding_notice_en: string;
  };
  contact: {
    headquarters_sw: string;
    headquarters_en: string;
    physical_address_sw: string;
    physical_address_en: string;
    building_number: string;
    street: string;
    po_box: string;
    phone_primary: string;
    phone_secondary: string;
    official_email: string;
    pr_email: string;
    working_hours_sw: string;
    working_hours_en: string;
    is_placeholder: boolean;
    verified: boolean;
    emrejesho_url: string;
    emrejesho_enabled: boolean;
  };
  social: {
    youtube: string;
    x_twitter: string;
    instagram: string;
    facebook: string;
    tiktok: string;
    linkedin: string;
  };
  seo: {
    title_template_sw: string;
    title_template_en: string;
    meta_description_sw: string;
    meta_description_en: string;
    og_image_url: string;
    canonical_base_url: string;
    robots_allow_indexing: boolean;
  };
  footer: {
    about_blurb_sw: string;
    about_blurb_en: string;
    copyright_sw: string;
    copyright_en: string;
    compliance_note_sw: string;
    compliance_note_en: string;
  };
  maintenance: {
    enabled: boolean;
    message_sw: string;
    message_en: string;
  };
  workflow: WorkflowRules & {
    enquiry_retention_days: number;
    audit_retention_days: number;
  };
  analytics: {
    internal_tracking_enabled: boolean;
    external_provider: string;
    external_site_id: string;
  };
}

export const DEFAULT_SITE_SETTINGS: SiteSettingsMap = {
  general: {
    site_name_sw: 'TBC — Tovuti ya Mawasiliano ya Shirika',
    site_name_en: 'TBC — Corporate Communication Portal',
    institution_name_sw: 'Shirika la Utangazaji Tanzania (TBC)',
    institution_name_en: 'Tanzania Broadcasting Corporation (TBC)',
    government_header_sw: 'Jamhuri ya Muungano wa Tanzania',
    government_header_en: 'The United Republic of Tanzania',
    tagline_sw: 'Ukweli na Uhakika — Idara ya Mawasiliano na Uhusiano wa Umma',
    tagline_en: 'Truth and Certainty — Corporate Communications & Public Relations',
    description_sw:
      'Tovuti rasmi ya mawasiliano ya shirika, uwazi wa kitaasisi, machapisho, matukio, ushiriki wa jamii na uhusiano wa wadau wa Shirika la Utangazaji Tanzania (TBC).',
    description_en:
      'Dedicated corporate communication portal for institutional identity, public relations, publications, events, community engagement, and stakeholder relations of the Tanzania Broadcasting Corporation (TBC).',
    main_broadcast_url: process.env.MAIN_TBC_WEBSITE_URL || 'https://www.tbc.go.tz/',
    default_language: 'sw',
    available_languages: ['sw', 'en'],
    show_demo_banner: true,
  },
  branding: {
    national_emblem_url: '/branding/tz-coat-of-arms.svg',
    institutional_logo_url: '/branding/tbc-logo.svg',
    verified: false,
    emblem_placement: 'left_right',
    branding_notice_sw:
      'Pakia faili rasmi zilizoidhinishwa za Nembo ya Taifa na Nembo ya TBC kabla ya uzinduzi rasmi.',
    branding_notice_en:
      'Upload certified master files for the National Emblem and TBC Logo via Admin Settings before official launch.',
  },
  contact: {
    headquarters_sw: 'Makao Makuu ya Shirika la Utangazaji Tanzania (TBC), Dar es Salaam',
    headquarters_en: 'Tanzania Broadcasting Corporation (TBC) Headquarters, Dar es Salaam',
    physical_address_sw: 'Barabara ya Nyerere, Dar es Salaam [THIBITISHA ANWANI RASMI NA TBC]',
    physical_address_en: 'Nyerere Road, Dar es Salaam [VERIFY OFFICIAL ADDRESS WITH TBC]',
    building_number: '[NAMBA YA JENGO — WEKA TAARIFA RASMI]',
    street: 'Barabara ya Nyerere [THIBITISHA NA TBC]',
    po_box: 'S.L.P. [WEKA S.L.P. RASMI YA TBC], Dar es Salaam, Tanzania',
    phone_primary: '[SIMU RASMI YA TBC — WEKA NAMBA ILIYOIDHINISHWA]',
    phone_secondary: '[SIMU YA IDARA YA MAWASILIANO — PLACEHOLDER]',
    official_email: '[barua.rasmi@tbc.go.tz — THIBITISHA NA TBC ICT]',
    pr_email: '[mawasiliano@tbc.go.tz — THIBITISHA NA TBC PR]',
    working_hours_sw: 'Jumatatu – Ijumaa: Saa 1:30 Asubuhi – Saa 9:30 Alasiri (EAT)',
    working_hours_en: 'Monday – Friday: 07:30 – 15:30 (East Africa Time)',
    is_placeholder: true,
    verified: false,
    emrejesho_url: process.env.EMREJESHO_PORTAL_URL || 'https://emrejesho.gov.go.tz/',
    emrejesho_enabled: process.env.EMREJESHO_LINK_ENABLED === 'true',
  },
  social: {
    youtube: '',
    x_twitter: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    linkedin: '',
  },
  seo: {
    title_template_sw: '%s | Shirika la Utangazaji Tanzania (TBC)',
    title_template_en: '%s | Tanzania Broadcasting Corporation (TBC)',
    meta_description_sw:
      'Tovuti ya Mawasiliano ya Shirika la Utangazaji Tanzania (TBC) — Taarifa za taasisi, huduma za utangazaji, machapisho, matukio, ushirikiano na ushiriki wa jamii.',
    meta_description_en:
      'Tanzania Broadcasting Corporation (TBC) Corporate Communication Website — Institutional profile, broadcasting services, publications, events, partnerships, and civic engagement.',
    og_image_url: '/media/images/headquarters-architecture.jpg',
    canonical_base_url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    robots_allow_indexing: true,
  },
  footer: {
    about_blurb_sw:
      'Tovuti hii inasimamiwa na Idara ya Mawasiliano na Uhusiano wa Umma ya TBC ikikamilisha tovuti kuu ya habari na matangazo (tbc.go.tz) kwa kutoa taarifa za kitaasisi, machapisho, ushirikiano na uhusiano wa wadau.',
    about_blurb_en:
      'Managed by the TBC Communication and Public Relations Department, complementing the main news and broadcasting portal (tbc.go.tz) with corporate identity, public records, partnerships, and stakeholder engagement.',
    copyright_sw:
      '© 2026 Shirika la Utangazaji Tanzania (TBC). Haki zote zimehifadhiwa.',
    copyright_en:
      '© 2026 Tanzania Broadcasting Corporation (TBC). All rights reserved.',
    compliance_note_sw:
      'Imeundwa kwa kuzingatia miongozo ya kiufundi ya Tovuti za Taasisi za Umma (eGA) — Inasubiri uhakiki rasmi wa TBC ICT.',
    compliance_note_en:
      'Engineered with reference to Tanzania e-Government website technical standards — Subject to formal TBC ICT & eGA review.',
  },
  maintenance: {
    enabled: false,
    message_sw:
      'Tovuti ya Mawasiliano ya Shirika la Utangazaji Tanzania (TBC) inafanyiwa maboresho ya kiufundi kwa muda mfupi. Kwa habari na matangazo ya moja kwa moja, tafadhali tembelea https://www.tbc.go.tz/.',
    message_en:
      'The TBC Corporate Communication Portal is currently undergoing scheduled maintenance. For live news and broadcasts, please visit https://www.tbc.go.tz/.',
  },
  workflow: {
    require_editor_review: true,
    require_director_approval: true,
    allow_delegated_approval: true,
    enquiry_retention_days: 730,
    audit_retention_days: 1095,
  },
  analytics: {
    internal_tracking_enabled: true,
    external_provider: process.env.ANALYTICS_PROVIDER || '',
    external_site_id: process.env.ANALYTICS_SITE_ID || '',
  },
};

export async function getSiteSettings(): Promise<SiteSettingsMap> {
  const db = await getDb();
  const res = await db.query<{ key: string; value_json: Record<string, unknown> }>(
    'SELECT key, value_json FROM site_settings'
  );
  const merged: SiteSettingsMap = JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));
  for (const row of res.rows) {
    const k = row.key as keyof SiteSettingsMap;
    if (k in merged && row.value_json && typeof row.value_json === 'object') {
      merged[k] = { ...merged[k], ...row.value_json } as never;
    }
  }
  return merged;
}

export async function updateSiteSettingGroup<K extends keyof SiteSettingsMap>(
  key: K,
  value: Partial<SiteSettingsMap[K]>,
  userId?: string | null
): Promise<SiteSettingsMap[K]> {
  const current = await getSiteSettings();
  const next = { ...current[key], ...value };
  const db = await getDb();
  await db.query(
    `INSERT INTO site_settings (key, value_json, group_name, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $1, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value_json = $2::jsonb, updated_by = $3, updated_at = NOW()`,
    [key, JSON.stringify(next), userId ?? null]
  );
  return next;
}

export interface MenuItemNode {
  id: string;
  location: string;
  parent_id: string | null;
  label_sw: string;
  label_en: string;
  description_sw: string;
  description_en: string;
  url: string;
  is_external: boolean;
  open_in_new_tab: boolean;
  sort_order: number;
  is_visible: boolean;
  children: MenuItemNode[];
}

export async function getNavigationMenus(includeHidden = false): Promise<Record<string, MenuItemNode[]>> {
  const db = await getDb();
  const where = includeHidden ? '' : 'WHERE is_visible = TRUE';
  const res = await db.query<Omit<MenuItemNode, 'children'>>(
    `SELECT id, location, parent_id, label_sw, label_en, description_sw, description_en,
            url, is_external, open_in_new_tab, sort_order, is_visible
     FROM menu_items
     ${where}
     ORDER BY location ASC, sort_order ASC, created_at ASC`
  );

  const byId = new Map<string, MenuItemNode>();
  const grouped: Record<string, MenuItemNode[]> = {
    main: [],
    utility: [],
    footer_about: [],
    footer_services: [],
    footer_resources: [],
    footer_legal: [],
  };

  for (const r of res.rows) {
    byId.set(r.id, { ...r, children: [] });
  }
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      if (!grouped[node.location]) grouped[node.location] = [];
      grouped[node.location].push(node);
    }
  }
  return grouped;
}
