import { NextRequest, NextResponse } from 'next/server';
const LANG_COOKIE_NAME='tbc_lang';
export function middleware(request:NextRequest){
 const lang=request.nextUrl.pathname.split('/')[1];
 const response=NextResponse.next();
 if(lang==='sw'||lang==='en')response.cookies.set(LANG_COOKIE_NAME,lang,{path:'/',maxAge:60*60*24*365,sameSite:'lax',httpOnly:true,secure:request.nextUrl.protocol==='https:'});
 return response;
}
export const config={matcher:['/sw/:path*','/en/:path*']};
