'use client';
import { useEffect, useState } from 'react';
import { BarChart3, Eye, Search, Users, Download } from 'lucide-react';

type Report={periodDays:number;summary:{views:number;visitors:number;searches:number;downloads:number};topPages:Array<{path:string;views:number}>;searchesByDay:Array<{day:string;count:number}>;generatedAt:string};
const cards=[['views','Page views',Eye],['visitors','Estimated visitors',Users],['searches','Search visits',Search],['downloads','Document downloads',Download]] as const;
export function AnalyticsReports(){
 const [report,setReport]=useState<Report|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let live=true;fetch('/api/admin/analytics',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Unable to load analytics.');return r.json()}).then(data=>{if(live)setReport(data)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 return <div className="admin-content"><div className="page-heading"><div><div className="eyebrow">REPORTING · PRIVACY-PRESERVING</div><h1>Website analytics</h1><p>Aggregated internal activity for the last 30 days. No raw IP addresses or search phrases are stored.</p></div></div>
 {error&&<div className="notice" role="alert">{error}</div>}{!report&&!error&&<div className="loading-screen" style={{height:180}}><div className="spinner"/></div>}
 {report&&<><div className="metrics-grid">{cards.map(([key,label,Icon])=><section className="metric-card" key={key}><div className="metric-head"><span>{label}</span><span className="metric-icon"><Icon/></span></div><div className="metric-number">{report.summary[key].toLocaleString()}</div><div className="metric-foot">Previous 30 days</div></section>)}</div>
 <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Most viewed pages</h2><p>Top routes in the previous 30 days</p></div><BarChart3 size={16}/></div><div className="panel-body">{report.topPages.length?<div className="table-wrap"><table><thead><tr><th>Page route</th><th>Views</th></tr></thead><tbody>{report.topPages.map(page=><tr key={page.path}><td><code>{page.path}</code></td><td>{page.views.toLocaleString()}</td></tr>)}</tbody></table></div>:<div className="empty-state">No page-view data recorded yet.</div>}</div></section>
 <section className="panel"><div className="panel-head"><div><h2>Search activity</h2><p>Daily search visits, not search terms</p></div><Search size={16}/></div><div className="panel-body">{report.searchesByDay.length?<div className="activity-list">{report.searchesByDay.slice(-10).reverse().map(day=><div className="activity-row" key={day.day}><div className="activity-copy"><strong>{day.day}</strong></div><div className="activity-time">{day.count} visits</div></div>)}</div>:<div className="empty-state">No search activity recorded yet.</div>}</div></section></div>
 <p className="metric-foot" style={{marginTop:16}}>Updated {new Date(report.generatedAt).toLocaleString()}</p></>}
 </div>
}
