import { cookies } from 'next/headers';
import { LANG_COOKIE_NAME } from './auth';

export type Lang = 'sw' | 'en';

export async function getActiveLang(searchParamLang?: string | null): Promise<Lang> {
  if (searchParamLang === 'en') return 'en';
  if (searchParamLang === 'sw') return 'sw';
  const cookieStore = await cookies();
  const c = cookieStore.get(LANG_COOKIE_NAME)?.value;
  return c === 'en' ? 'en' : 'sw'; // Kiswahili is the official default language per eGA standard
}

export function pickLang(
  lang: Lang,
  sw: string | null | undefined,
  en: string | null | undefined,
  statusSw?: string | null,
  statusEn?: string | null
): { text: string; translationUnavailable: boolean; displayedLang: Lang } {
  const swText = (sw || '').trim();
  const enText = (en || '').trim();

  if (lang === 'en') {
    if (statusEn === 'published' && enText) {
      return { text: enText, translationUnavailable: false, displayedLang: 'en' };
    }
    if (!statusEn && enText) {
      return { text: enText, translationUnavailable: false, displayedLang: 'en' };
    }
    return { text: swText, translationUnavailable: true, displayedLang: 'sw' };
  }

  if (statusSw === 'unavailable' && enText) {
    return { text: enText, translationUnavailable: true, displayedLang: 'en' };
  }
  return { text: swText || enText, translationUnavailable: !swText && Boolean(enText), displayedLang: swText ? 'sw' : 'en' };
}

export function t(lang: Lang, sw: string, en: string): string {
  return lang === 'en' ? en : sw;
}

export function formatDate(dateStr: string | Date | null | undefined, lang: Lang): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const monthsSw = [
    'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
    'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba',
  ];
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const day = d.getUTCDate();
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  return lang === 'sw' ? `${day} ${monthsSw[m]} ${y}` : `${day} ${monthsEn[m]} ${y}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DAY_LABELS: Record<string, { sw: string; en: string; shortSw: string; shortEn: string }> = {
  mon: { sw: 'Jumatatu', en: 'Monday', shortSw: 'Jtt', shortEn: 'Mon' },
  tue: { sw: 'Jumanne', en: 'Tuesday', shortSw: 'Jnn', shortEn: 'Tue' },
  wed: { sw: 'Jumatano', en: 'Wednesday', shortSw: 'Jtn', shortEn: 'Wed' },
  thu: { sw: 'Alhamisi', en: 'Thursday', shortSw: 'Alh', shortEn: 'Thu' },
  fri: { sw: 'Ijumaa', en: 'Friday', shortSw: 'Iju', shortEn: 'Fri' },
  sat: { sw: 'Jumamosi', en: 'Saturday', shortSw: 'Jms', shortEn: 'Sat' },
  sun: { sw: 'Jumapili', en: 'Sunday', shortSw: 'Jpi', shortEn: 'Sun' },
};

export const PUBLICATION_CATEGORIES: Array<{ slug: string; sw: string; en: string }> = [
  { slug: 'press_releases', sw: 'Taarifa kwa Vyombo vya Habari', en: 'Press Releases' },
  { slug: 'public_announcements', sw: 'Matangazo kwa Umma', en: 'Public Announcements' },
  { slug: 'institutional_reports', sw: 'Ripoti za Taasisi', en: 'Institutional Reports' },
  { slug: 'annual_reports', sw: 'Ripoti za Mwaka', en: 'Annual Reports' },
  { slug: 'strategic_plans', sw: 'Mipango Mkakati', en: 'Strategic Plans' },
  { slug: 'corporate_publications', sw: 'Machapisho ya Shirika', en: 'Corporate Publications' },
  { slug: 'bango_newsletters', sw: 'Jarida la Bango na Majarida ya Shirika', en: 'Bango & Institutional Newsletters' },
  { slug: 'policies', sw: 'Sera na Miongozo', en: 'Policies' },
  { slug: 'acts_regulations', sw: 'Sheria na Kanuni', en: 'Acts & Regulations' },
  { slug: 'tbc_laws', sw: 'Sheria Zinazohusu TBC', en: 'TBC-Related Laws' },
  { slug: 'contracts_procurement', sw: 'Mikataba na Ununuzi wa Umma (Ulioidhinishwa)', en: 'Contracts & Public Procurement' },
  { slug: 'official_speeches', sw: 'Hotuba Rasmi', en: 'Official Speeches' },
  { slug: 'public_notices', sw: 'Ilani kwa Umma', en: 'Public Notices' },
  { slug: 'other_documents', sw: 'Nyaraka Nyingine Zilizoidhinishwa', en: 'Other Approved Documents' },
];

export const EVENT_CATEGORIES: Array<{ slug: string; sw: string; en: string }> = [
  { slug: 'official_visit', sw: 'Ziara Rasmi', en: 'Official Visits' },
  { slug: 'government_delegation', sw: 'Ziara za Ujumbe wa Serikali', en: 'Government Delegation Visits' },
  { slug: 'institutional_meeting', sw: 'Mikutano ya Taasisi', en: 'Institutional Meetings' },
  { slug: 'ceremony', sw: 'Hafla za Shirika', en: 'Corporate Ceremonies' },
  { slug: 'major_announcement', sw: 'Matangazo Makuu', en: 'Major Announcements' },
  { slug: 'conference', sw: 'Makongamano', en: 'Conferences' },
  { slug: 'workshop', sw: 'Warsha na Mafunzo', en: 'Workshops' },
  { slug: 'launch', sw: 'Uzinduzi wa Kitaasisi', en: 'Institutional Launches' },
  { slug: 'corporate_activity', sw: 'Shughuli za Shirika', en: 'Corporate Activities' },
];

export const PERSONNEL_CATEGORIES: Array<{ slug: string; sw: string; en: string }> = [
  { slug: 'journalist', sw: 'Waandishi wa Habari', en: 'Journalists' },
  { slug: 'news_presenter', sw: 'Watangazaji wa Habari', en: 'News Presenters' },
  { slug: 'radio_presenter', sw: 'Watangazaji wa Redio', en: 'Radio Presenters' },
  { slug: 'tv_presenter', sw: 'Watangazaji wa Televisheni', en: 'Television Presenters' },
  { slug: 'producer', sw: 'Watayarishaji wa Vipindi', en: 'Programme Producers' },
  { slug: 'editor', sw: 'Wahariri', en: 'Editors' },
  { slug: 'camera_operator', sw: 'Waendeshaji Kamera', en: 'Camera Operators' },
  { slug: 'technical', sw: 'Wataalamu wa Ufundi', en: 'Technical Personnel' },
  { slug: 'production_specialist', sw: 'Wataalamu wa Uzalishaji', en: 'Production Specialists' },
  { slug: 'other', sw: 'Wataalamu Wengine wa TBC', en: 'Other Approved TBC Professionals' },
];

export const FORM_TYPE_LABELS: Record<string, { sw: string; en: string; refPrefix: string }> = {
  general_enquiry: { sw: 'Ulizo la Jumla', en: 'General Enquiry', refPrefix: 'TBC-GEN' },
  contact: { sw: 'Wasiliana Nasi', en: 'Contact Us', refPrefix: 'TBC-CNT' },
  stakeholder_feedback: { sw: 'Maoni ya Wadau', en: 'Stakeholder Feedback', refPrefix: 'TBC-FDB' },
  testimonial: { sw: 'Ushuhuda wa Mdau', en: 'Stakeholder Testimonial', refPrefix: 'TBC-TST' },
  partnership_inquiry: { sw: 'Ombi la Ushirikiano wa Kitaasisi', en: 'Partnership Inquiry', refPrefix: 'TBC-PRT' },
  sponsorship_inquiry: { sw: 'Ombi la Udhamini na Matangazo', en: 'Sponsorship & Advertising Inquiry', refPrefix: 'TBC-SPN' },
  production_inquiry: { sw: 'Ushirikiano wa Uzalishaji wa Vipindi', en: 'Programme Production Inquiry', refPrefix: 'TBC-PRD' },
  media_inquiry: { sw: 'Ulizo la Vyombo vya Habari', en: 'Media Inquiry', refPrefix: 'TBC-MED' },
  regional_office_enquiry: { sw: 'Ulizo kwa Ofisi ya Kanda', en: 'Regional Office Enquiry', refPrefix: 'TBC-REG' },
};
