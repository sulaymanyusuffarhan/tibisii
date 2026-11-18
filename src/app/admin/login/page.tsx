'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mfaCode,setMfaCode]=useState('');
  const [showMfa,setShowMfa]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,...(mfaCode?{mfaCode}:{})})});
      const result=await response.json();
      if(!response.ok){setError(result.error||'Sign in was unsuccessful.');if(result.mfaRequired)setShowMfa(true);return;}
      router.replace('/admin/dashboard');router.refresh();
    }catch{setError('The administration service could not be reached. Try again shortly.');}
    finally{setBusy(false);}
  }
  return <div className="login-screen">
    <section className="login-brand-panel">
      <div className="login-brand-top"><img src="/branding/tbc-logo.svg" alt="TBC logo"/><div><strong>TANZANIA BROADCASTING CORPORATION</strong><small>Corporate Communications & Public Relations</small></div></div>
      <div className="login-message"><div className="eyebrow">INTERNAL ADMINISTRATION</div><h1>Good communication begins behind the scenes.</h1><p>Manage institutional stories, public information and the content that connects TBC with the nation.</p></div>
      <div className="login-foot">Jamhuri ya Muungano wa Tanzania<br/>TBC Corporate Communication Portal · Authorized personnel only</div>
    </section>
    <section className="login-form-side"><div className="login-card">
      <div className="eyebrow">ADMINISTRATOR PORTAL</div><h2>Welcome back</h2><p>Sign in using your authorized TBC account to continue to the content management workspace.</p>
      {error&&<div className="form-alert" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="email">Official email address</label><input id="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="name@tbc.go.tz"/></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e)=>setPassword(e.target.value)}/></div>
        {showMfa&&<div className="field"><label htmlFor="mfa">Authenticator code or recovery code</label><input id="mfa" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e)=>setMfaCode(e.target.value)} maxLength={32} required/></div>}
        <button className="button" type="submit" disabled={busy}>{busy?'Verifying account…':showMfa?'Verify and sign in':'Secure sign in'}<ArrowRight size={15}/></button>
      </form>
      <div className="login-note"><ShieldCheck size={14} style={{verticalAlign:'middle',marginRight:5,color:'#167469'}}/> Protected access. All sign-in attempts are recorded for security review.<br/><a href="/admin/forgot-password" style={{color:'#086b61',fontWeight:700}}>Forgot your password?</a> Contact your TBC system administrator if you need account assistance.</div>
    </div></section>
  </div>;
}
