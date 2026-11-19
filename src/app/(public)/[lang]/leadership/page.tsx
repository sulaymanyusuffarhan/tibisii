import { notFound } from 'next/navigation';
import { getLeadership } from '@/lib/public-site';
import { Breadcrumbs, EmptyState, PageHeading } from '@/components/public/PublicKit';
import type { Lang } from '@/lib/i18n';

export default async function LeadershipPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (raw !== 'sw' && raw !== 'en') notFound();
  const lang = raw as Lang;
  const leaders = await getLeadership(lang);
  const t = (sw: string, en: string) => lang === 'sw' ? sw : en;
  return <>
    <Breadcrumbs lang={lang} items={[{ label: t('Kuhusu TBC', 'About TBC'), href: `/${lang}/about` }, { label: t('Uongozi', 'Leadership') }]} />
    <PageHeading lang={lang} eyebrow={t('UONGOZI WA TAASISI', 'INSTITUTIONAL LEADERSHIP')} title={t('Uongozi wa TBC', 'TBC leadership')} summary={t('Wasifu wa viongozi wa sasa utaonyeshwa hapa baada ya uthibitisho. Taarifa za mfano na majina ya nafasi hazichukuliwi kuwa viongozi halisi.', 'Verified profiles of current leaders will be shown here. Demonstration records and role placeholders are not treated as real office holders.')} />
    <section className="public-container content-section">
      {leaders.length ? <div className="leadership-grid">{leaders.map(item => <article className="leader-card" key={item.id}>
        {item.image ? <img src={item.image} alt={item.alt || item.name} /> : <div className="leader-avatar">{item.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>}
        <div className="leader-card-info"><span className="eyebrow">{item.group?.replaceAll('_', ' ')}</span><h2>{item.name}</h2><strong>{item.position}</strong>{item.period && <small>{item.period}</small>}{item.bio && <p>{item.bio}</p>}</div>
      </article>)}</div> : <EmptyState lang={lang} title={t('Wasifu wa viongozi haujachapishwa', 'No verified leadership profiles are published')} body={t('Wasifu na vyeo vitachapishwa baada ya kuidhinishwa rasmi na TBC.', 'Profiles and titles will be published after formal approval by TBC.')} />}
    </section>
  </>;
}
