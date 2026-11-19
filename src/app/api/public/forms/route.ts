import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { getClientIp,generateReferenceNumber,createId,sha256Hex } from '@/lib/security';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getSiteSettings } from '@/lib/settings';
import { sendSystemEmail,getEmailConfigStatus } from '@/lib/email';
import { isPublicFormType,PUBLIC_FORM_TYPES } from '@/lib/public-forms';

const schema=z.object({formType:z.string().max(40),language:z.enum(['sw','en']),fullName:z.string().trim().min(2).max(160),email:z.string().trim().email().max(254),organization:z.string().trim().max(180).optional().default(''),phone:z.string().trim().max(40).optional().default(''),roleOrOrg:z.string().trim().max(180).optional().default(''),region:z.string().trim().max(100).optional().default(''),subject:z.string().trim().min(3).max(180),message:z.string().trim().min(10).max(8000),consent:z.literal(true),website:z.string().max(300).optional().default('')}).strict();
function sameOrigin(req:NextRequest){const origin=req.headers.get('origin');if(!origin)return false;try{const originUrl=new URL(origin);const host=(req.headers.get('x-forwarded-host')||req.headers.get('host')||'').split(',')[0].trim();return originUrl.host.toLowerCase()===host.toLowerCase()&&['http:','https:'].includes(originUrl.protocol)}catch{return false}}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'This form can only be submitted from the TBC website.'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Please check the required fields and try again.'},{status:400});
 const input=parsed.data;if(!isPublicFormType(input.formType))return NextResponse.json({error:'Unknown enquiry form.'},{status:400});
 const config=PUBLIC_FORM_TYPES[input.formType];
 if(input.website)return NextResponse.json({ok:true,referenceNumber:generateReferenceNumber(config.prefix)});
 const ip=getClientIp(req);const ipLimit=await consumeRateLimit('public-form-ip',ip,6,3600);if(!ipLimit.allowed)return NextResponse.json({error:'Too many submissions. Please try again later.'},{status:429,headers:{'Retry-After':String(Math.max(1,Math.ceil((ipLimit.resetAt.getTime()-Date.now())/1000)))}});
 const normalizedEmail=input.email.toLowerCase();const emailLimit=await consumeRateLimit('public-form-email',normalizedEmail,3,3600);if(!emailLimit.allowed)return NextResponse.json({error:'Too many submissions for this email address. Please try again later.'},{status:429});
 const db=await getDb();const settings=await getSiteSettings();const retentionDays=Math.min(3650,Math.max(30,settings.workflow.enquiry_retention_days||730));const reference=generateReferenceNumber(config.prefix);const id=createId('enq');const emailStatus=getEmailConfigStatus();
 const payload={roleOrOrg:input.roleOrOrg||'',region:input.region||'',formVersion:'2026-02-v1'};
 await db.transaction(async tx=>{
  await tx.query(`INSERT INTO form_submissions(id,reference_number,form_type,full_name,organization,email,phone,subject,message,payload_json,language,status,priority,email_notification_status,ip_address,retention_until,privacy_consent_at,privacy_notice_version)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,'new','normal','not_configured',$12,NOW()+($13::text||' days')::interval,NOW(),'2026-02-v1')`,
   [id,reference,input.formType,input.fullName,input.organization,normalizedEmail,input.phone,input.subject,input.message,JSON.stringify(payload),input.language,sha256Hex(`${ip}|${process.env.SESSION_SECRET||'tbc-public'}`).slice(0,32),retentionDays]);
  if(input.formType==='testimonial'){
   const quoteSw=input.language==='sw'?input.message:'';const quoteEn=input.language==='en'?input.message:'';
   await tx.query(`INSERT INTO testimonials(id,reference_number,submitter_name,submitter_role_or_org,submitter_region,submitter_email,category,quote_sw,quote_en,original_language,moderation_status,is_demo)
    VALUES($1,$2,$3,$4,$5,$6,'stakeholder',$7,$8,$9,'pending',FALSE)`,[createId('tst'),reference,input.fullName,input.roleOrOrg||input.organization,input.region,normalizedEmail,quoteSw,quoteEn,input.language]);
  }
 });
 let notificationStatus:'sent'|'not_configured'|'failed'='not_configured';
 if(emailStatus.configured&&emailStatus.notificationRecipient){
  const result=await sendSystemEmail({to:emailStatus.notificationRecipient,subject:`New TBC public enquiry ${reference}`,text:[`Reference: ${reference}`,`Form type: ${input.formType}`,`Language: ${input.language}`,`Name: ${input.fullName}`,`Organization: ${input.organization}`,`Email: ${normalizedEmail}`,`Telephone: ${input.phone}`,`Subject: ${input.subject}`,`Message:`,input.message].join('\n')});notificationStatus=result.status;
  await db.query('UPDATE form_submissions SET email_notification_status=$1 WHERE id=$2',[notificationStatus,id]);
 }
 return NextResponse.json({ok:true,referenceNumber:reference,emailNotificationStatus:notificationStatus},{status:201});
}
