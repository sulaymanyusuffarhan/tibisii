'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Download, FileText, Image, Inbox, Plus, Radio, Send, ShieldCheck, Users } from 'lucide-react';

type DashboardData={metrics:Record<string,number>;activity:Array<{id:string;user_email:string;user_role:string;action:string;summary:string;created_at:string}>;contentTrend:Array<{month:string;count:number}>;generatedAt:string};
const statCards=[
  {key:'publishedArticles',label:'Published articles',detail:'Available on the public site',icon:FileText},
  {key:'drafts',label:'Content drafts',detail:'Editorial work in progress',icon:BookOpen},
  {key:'pendingReview',label:'Awaiting review',detail:'Submitted or under review',icon:Send},
  {key:'publications',label:'Published documents',detail:'Items in the publications library',icon:Download},
  {key:'publishedEvents',label:'Published events',detail:'Institutional activities',icon:CalendarDays},
  {key:'mediaAssets',label:'Media library',detail:'Stored media records',icon:Image},
  {key:'openEnquiries',label:'Open enquiries',detail:'New or in progress',icon:Inbox},
  {key:'pendingTestimonials',label:'Testimonials to moderate',detail:'Not public until approved',icon:ShieldCheck},
];
const quick=[
  {href:'/admin/content/articles',label:'Create an article',sub:'Draft a story or announcement',icon:Plus},
  {href:'/admin/content/events',label:'Add an event',sub:'Record an institutional activity',icon:CalendarDays},
  {href:'/admin/content/publications',label:'Add a publication',sub:'Upload a public document record',icon:Download},
  {href:'/admin/users',label:'Manage accounts',sub:'Users, roles and access',icon:Users},
];
function timeAgo(value:string){const ms=Date.now()-new Date(value).getTime();if(ms<60_000)return 'Just now';if(ms<3_600_000)return `${Math.floor(ms/60_000)} min ago`;if(ms<86_400_000)return `${Math.floor(ms/3_600_000)} hr ago`;return new Date(value).toLocaleDateString('en-TZ',{day:'numeric',month:'short'});}

export function Dashboard(){
  const [data,setData]=useState<DashboardData|null>(null);const [error,setError]=useState('');
  useEffect(()=>{let active=true;fetch('/api/admin/dashboard',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error((await r.json()).error||'Unable to load dashboard.');return r.json();}).then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[]);
  const maximum=Math.max(1,...(data?.contentTrend.map(v=>v.count)||[1]));
  return <div className="admin-content">
    <div className="page-heading"><div><div className="eyebrow">TBC · CORPORATE COMMUNICATIONS</div><h1>Good morning, welcome back.</h1><p>A clear view of your editorial workspace and institutional content.</p></div><Link href="/admin/content/articles" className="button"><Plus size={15}/>Create content</Link></div>
    {error&&<div className="notice" role="alert">{error}</div>}
    {!data?<div className="loading-screen" style={{height:220}}><div className="spinner"/></div>:<>
      <div className="metrics-grid">{statCards.map(({key,label,detail,icon:Icon})=><div className="metric-card" key={key}><div className="metric-head"><span>{label}</span><span className="metric-icon"><Icon/></span></div><div className="metric-number">{data.metrics[key]??0}</div><div className="metric-foot">{detail}</div></div>)}</div>
      <div className="dashboard-grid">
        <section className="panel"><div className="panel-head"><div><h2>Editorial activity</h2><p>Article records created in the recent six-month window</p></div><span className="status-badge">Live database</span></div>
          <div className="panel-body">{data.contentTrend.length===0?<div className="empty-state"><FileText/><div>No article activity recorded yet.</div></div>:<div className="trend-chart" aria-label="Article creation by month">{data.contentTrend.map((point)=><div className="trend-item" key={point.month}><div className="trend-bar-wrap"><div className="trend-bar" style={{height:`${Math.max(4,point.count/maximum*100)}%`}} title={`${point.count} content records`}/></div><span className="trend-count">{point.count}</span><span className="trend-label">{point.month}</span></div>)}</div>}</div>
        </section>
        <section className="panel"><div className="panel-head"><div><h2>Recent administrative activity</h2><p>Audited actions across the CMS</p></div><ShieldCheck size={16} color="#14766b"/></div>
          <div className="panel-body activity-list">{data.activity.length===0?<div className="empty-state"><ShieldCheck/><div>Administrative activity will appear here.</div></div>:data.activity.map((item)=><div className="activity-row" key={item.id}><div className="activity-dot"><Radio/></div><div className="activity-copy"><strong>{item.user_email||'System'}</strong> · {item.summary}<span>{item.user_role||'system'} · {item.action}</span></div><div className="activity-time">{timeAgo(item.created_at)}</div></div>)}</div>
        </section>
      </div>
      <div className="quick-grid">{quick.map(({href,label,sub,icon:Icon})=><Link className="quick-card" href={href} key={href}><Icon/><span>{label}<small>{sub}</small></span><ArrowUpRight size={13} style={{marginLeft:'auto',color:'#97a4a4'}}/></Link>)}</div>
      <div style={{marginTop:20,fontSize:9,color:'#829093',display:'flex',gap:6,alignItems:'center'}}><ShieldCheck size={12}/> Metrics reflect stored CMS records. No demonstration metrics are included. Last refreshed {new Date(data.generatedAt).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'})}.</div>
    </>}
  </div>;
}
