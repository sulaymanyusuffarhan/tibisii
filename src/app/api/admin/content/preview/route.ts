import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { sanitizeRichHtml } from '@/lib/security';

const schema=z.object({titleSw:z.string().max(240),titleEn:z.string().max(240).optional(),summarySw:z.string().max(5000).optional(),summaryEn:z.string().max(5000).optional(),bodySw:z.string().max(200000).optional(),bodyEn:z.string().max(200000).optional(),language:z.enum(['sw','en']).default('sw')}).strict();
export async function POST(req:NextRequest){
 const auth=await requireApiAuth(req,['content.create','content.view','pages.view','events.view','publications.view']);if('response'in auth)return auth.response;
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Preview content is invalid.'},{status:400});
 const item=parsed.data;const english=item.language==='en';
 return NextResponse.json({title:english?item.titleEn||item.titleSw:item.titleSw,summary:english?item.summaryEn||'':item.summarySw||'',html:sanitizeRichHtml(english?item.bodyEn||'':item.bodySw||''),language:english?'en':'sw'},{headers:{'Cache-Control':'no-store'}});
}
