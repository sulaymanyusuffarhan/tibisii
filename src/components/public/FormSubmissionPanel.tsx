'use client';
import { FormEvent, useState } from 'react';
import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import { PUBLIC_FORM_TYPES, type PublicFormType } from '@/lib/public-forms';

export function FormSubmissionPanel({lang,type}:{lang:Lang;type:PublicFormType}){
 const config=PUBLIC_FORM_TYPES[type];const en=lang==='en';const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [reference,setReference]=useState('');
 const t=(sw:string,enText:string)=>en?enText:sw;
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;setBusy(true);setError('');setReference('');const data=new FormData(form);const payload=Object.fromEntries(data.entries());try{const response=await fetch('/api/public/forms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,formType:type,language:lang,consent:data.get('consent')==='on'})});const result=await response.json();if(!response.ok)throw new Error(result.error||t('Ujumbe haukutumwa. Tafadhali jaribu tena.','Your message could not be sent. Please try again.'));setReference(result.referenceNumber||'');form.reset()}catch(e){setError(e instanceof Error?e.message:t('Hitilafu imetokea.','Something went wrong.'))}finally{setBusy(false)}}
 if(reference)return <div className="form-success" role="status"><CheckCircle2/><h2>{t('Ujumbe umepokelewa','Your message has been received')}</h2><p>{t('Tafadhali hifadhi namba hii kwa ufuatiliaji.','Keep this reference number for follow-up.')}</p><strong>{reference}</strong><p>{t('Hii si uthibitisho wa kutumwa kwa barua pepe. Taarifa huhifadhiwa kwenye mfumo wa TBC; muda wa majibu hutegemea mapitio ya taasisi.','This does not confirm email delivery. The submission is stored in TBC’s system; response times depend on institutional review.')}</p></div>;
 return <form className="public-form" onSubmit={submit}>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="form-grid"><label>{t('Jina kamili','Full name')} *<input name="fullName" autoComplete="name" required maxLength={160}/></label><label>{t('Barua pepe','Email')} *<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>{t('Taasisi au shirika','Organization')}<input name="organization" autoComplete="organization" maxLength={180}/></label><label>{t('Simu (si lazima)','Telephone (optional)')}<input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label>
  {type==='regional_office_enquiry'&&<label>{t('Mkoa au eneo','Region or area')}<input name="region" maxLength={100}/></label>}
  {type==='testimonial'&&<label>{t('Jukumu au taasisi yako','Your role or organization')}<input name="roleOrOrg" maxLength={180}/></label>}
  <label className="form-full">{t('Mada','Subject')} *<input name="subject" required maxLength={180}/></label><label className="form-full">{type==='testimonial'?t('Ushuhuda wako','Your testimonial'):t('Ujumbe','Message')} *<textarea name="message" required minLength={10} maxLength={8000} rows={7}/><small>{t('Usiweke taarifa nyeti, siri au namba za utambulisho. Herufi 10–8,000.','Do not include sensitive information, secrets or identity numbers. 10–8,000 characters.')}</small></label></div>
  <label className="form-consent"><input type="checkbox" name="consent" required/><span>{t('Nimeisoma Sera ya Faragha na ninakubali taarifa zangu zitumike kushughulikia ombi hili.','I have read the Privacy Notice and consent to my information being used to handle this enquiry.')} <a href={`/${lang}/privacy`} target="_blank" rel="noreferrer">{t('Sera ya Faragha','Privacy Notice')}</a></span></label>
  <label className="form-honeypot" aria-hidden="true" tabIndex={-1}>Website<input name="website" autoComplete="off" tabIndex={-1}/></label>
  <button className="public-button dark" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Send size={15}/>} {busy?t('Inatumwa…','Sending…'):t('Tuma ujumbe','Submit enquiry')}</button>
  <p className="form-retention">{t('Ombi litahifadhiwa kwa muda unaotakiwa na sera ya uhifadhi wa taarifa ya taasisi. Hakuna kiambatisho kinachopokelewa kupitia fomu hii.','This enquiry is retained under the institution’s configured records-retention policy. This form does not accept attachments.')}</p>
 </form>
}
