import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NextRequest} from 'next/server';
import {middleware} from '../src/middleware';
import {LANG_COOKIE_NAME} from '../src/lib/auth';
import {PUBLIC_FORM_TYPES} from '../src/lib/public-forms';
import {DEFAULT_SITE_SETTINGS} from '../src/lib/settings';
async function main(){assert.equal(LANG_COOKIE_NAME,'tbc_lang');for(const[lang,path]of [['sw','/sw'],['en','/en/about/history']] as const){const response=middleware(new NextRequest(`https://portal.example${path}`));assert.equal(response.cookies.get(LANG_COOKIE_NAME)?.value,lang,`${lang} locale persists in a preference cookie`);assert.equal(response.cookies.get(LANG_COOKIE_NAME)?.httpOnly,true);assert.equal(response.cookies.get(LANG_COOKIE_NAME)?.sameSite,'lax');assert.equal(response.cookies.get(LANG_COOKIE_NAME)?.secure,true)}
 assert.equal(DEFAULT_SITE_SETTINGS.branding.verified,false,'supplied artwork must not be presented as standards-verified without review');assert.ok(fs.existsSync('public/branding/tbc-logo.webp'));assert.ok(fs.existsSync('public/branding/tanzania-emblem.png'));assert.equal(Object.keys(PUBLIC_FORM_TYPES).length,9);for(const form of Object.values(PUBLIC_FORM_TYPES)){assert.ok(form.sw.length>1);assert.ok(form.en.length>1)}assert.ok(fs.existsSync('src/app/(public)/[lang]/accessibility/page.tsx'));assert.ok(fs.existsSync('src/app/(public)/[lang]/privacy/page.tsx'));console.log('Phase 6 checks passed: path-locale persistence, secure language preference cookie flags, supplied TBC/National Emblem assets, nine bilingual forms, and government accessibility/privacy routes.')}
main().catch(error=>{console.error(error);process.exitCode=1});
