'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Archive, BookOpen, CalendarDays, FileText, KeyRound, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';

type SessionUser = { id: string; email: string; fullName: string; jobTitle: string; roleSlug: string; roleNameSw: string; roleNameEn: string; permissions: string[] };
const links = [
  { href: '/admin/dashboard', label: 'Overview', sw: 'Muhtasari', icon: LayoutDashboard, permission: 'dashboard.view', section: 'Workspace' },
  { href: '/admin/content/articles', label: 'Articles & stories', sw: 'Makala na simulizi', icon: FileText, permission: 'content.view', section: 'Editorial' },
  { href: '/admin/content/pages', label: 'Institutional pages', sw: 'Kurasa za taasisi', icon: BookOpen, permission: 'pages.view', section: 'Editorial' },
  { href: '/admin/content/events', label: 'Events', sw: 'Matukio', icon: CalendarDays, permission: 'events.view', section: 'Editorial' },
  { href: '/admin/content/publications', label: 'Publications', sw: 'Machapisho', icon: Archive, permission: 'publications.view', section: 'Editorial' },
  { href: '/admin/users', label: 'User accounts', sw: 'Watumiaji', icon: Users, permission: 'users.manage', section: 'Administration' },
  { href: '/admin/roles', label: 'Roles & permissions', sw: 'Majukumu na ruhusa', icon: ShieldCheck, permission: 'roles.manage', section: 'Administration' },
  { href: '/admin/security', label: 'Account security', sw: 'Usalama wa akaunti', icon: KeyRound, permission: 'account.security', section: 'Administration' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const loginPage = ['/admin/login','/admin/forgot-password','/admin/reset-password'].includes(pathname);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(loginPage);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loginPage) { setReady(true); return; }
    let live = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) { router.replace('/admin/login'); return; }
        const data = await response.json();
        if (live) setUser(data.user);
      })
      .catch(() => router.replace('/admin/login'))
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [loginPage, pathname, router]);

  if (loginPage) return <>{children}</>;
  if (!ready || !user) return <div className="loading-screen"><div className="spinner" aria-label="Verifying administrator session" /></div>;

  const visibleLinks = links.filter((item) => item.permission === 'account.security' || user.roleSlug === 'super_admin' || user.permissions.includes(item.permission));
  const sections = [...new Set(visibleLinks.map((item) => item.section))];
  const current = visibleLinks.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/admin/login');
    router.refresh();
  }

  return <div className="admin-frame">
    <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><img src="/branding/tbc-logo.svg" alt="TBC" /></div>
        <div className="brand-name">TBC CORPORATE CMS<small>MAWASILIANO YA SHIRIKA</small></div>
        <button className="icon-button mobile-menu" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X /></button>
      </div>
      {sections.map((section) => <div key={section}>
        <div className="nav-caption">{section}</div>
        <nav className="side-nav" aria-label={section}>
          {visibleLinks.filter((item) => item.section === section).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={`side-link ${active ? 'active' : ''}`} onClick={() => setMenuOpen(false)}><Icon aria-hidden="true" /><span>{label}</span></Link>;
          })}
        </nav>
      </div>)}
      <div className="side-bottom"><strong>{user.fullName}</strong>{user.roleNameEn || user.roleSlug}<br />Tanzania Broadcasting Corporation</div>
    </aside>
    {menuOpen && <button aria-label="Close navigation overlay" className="mobile-scrim" onClick={() => setMenuOpen(false)} />}
    <main className="admin-main">
      <header className="topbar">
        <div className="crumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu /></button><span>TBC CMS</span><span>/</span><strong>{current?.label ?? 'Administration'}</strong></div>
        <div className="top-actions"><div className="secure-pill"><ShieldCheck size={13} /> Secure administration</div><div className="user-mini"><span className="user-avatar">{user.fullName.split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase()}</span><span>{user.fullName}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut /></button></div>
      </header>
      {children}
    </main>
  </div>;
}
