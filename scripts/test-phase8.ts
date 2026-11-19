import assert from 'node:assert/strict';
import fs from 'node:fs';

function main(){
 const css=fs.readFileSync('src/app/globals.css','utf8');
 const widths=[480,520,600,780,900,1000,1100];for(const width of widths)assert.match(css,new RegExp(`@media\\s*\\(max-width:${width}px\\)`),`responsive rules exist for ${width}px and narrower viewports`);
 assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/,'reduced-motion preference is handled');
 assert.match(css,/focus-visible/,'keyboard focus treatment is defined');
 assert.match(css,/\.public-container\{[^}]*calc\(100%\s*-\s*64px\)/,'public layout uses a viewport-relative container');
 assert.match(css,/\.media-grid\{[^}]*grid-template-columns/,'media library has a responsive grid layout');
 assert.match(css,/\.admin-frame|\.admin-sidebar/,'administration shell styles exist');
 const publicShell=fs.readFileSync('src/components/public/PublicHeader.tsx','utf8');assert.match(publicShell,/aria-label=/,'primary navigation has an accessible label');assert.match(publicShell,/mobile-nav/,'mobile navigation is present');
 const forms=fs.readFileSync('src/components/public/FormSubmissionPanel.tsx','utf8');assert.match(forms,/<label[^>]*>[^<]*[\s\S]*?name="fullName"/,'required form fields are wrapped by labels');assert.match(forms,/name="consent"[^>]*required/,'consent is an explicit required checkbox');assert.match(forms,/role="alert"/,'form errors are announced to assistive technology');
 console.log('Phase 8 static regression checks passed: seven responsive breakpoints, reduced-motion support, keyboard focus, viewport containers, responsive media grids and core navigation/form accessibility. These source checks complement, but do not replace, visual browser testing at real viewport sizes.');
}
try{main()}catch(error){console.error('Phase 8 responsive/security regression checks failed:',error);process.exitCode=1}
