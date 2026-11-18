import assert from 'node:assert/strict';
import { getDb, closeDb, runMigrations, promoteScheduledContent } from '../src/lib/db';
import { seedDatabase } from '../src/lib/seed-data';
import { createId, sanitizeRichHtml } from '../src/lib/security';
import { canExecuteWorkflowTransition } from '../src/lib/permissions';

async function main(){
 process.env.DATABASE_URL='pglite://memory://';process.env.AUTO_INIT_DB='false';process.env.SESSION_SECRET='phase-three-test-secret'.padEnd(40,'x');
 const db=await getDb();
 try{
  await runMigrations(db);await seedDatabase(db);
  const contributor={permissions:['content.create','content.edit_own'],roleSlug:'contributor',delegatedPublish:false,isOwner:true,domain:'content' as const};
  assert.equal(canExecuteWorkflowTransition({...contributor,fromStatus:'draft',toStatus:'submitted'}).allowed,true);
  assert.equal(canExecuteWorkflowTransition({...contributor,fromStatus:'under_review',toStatus:'approved'}).allowed,false,'contributors cannot approve');
  const editor={permissions:['content.review'],roleSlug:'editor',delegatedPublish:false,isOwner:false,domain:'content' as const};
  assert.equal(canExecuteWorkflowTransition({...editor,fromStatus:'submitted',toStatus:'under_review'}).allowed,true);
  assert.equal(canExecuteWorkflowTransition({...editor,fromStatus:'under_review',toStatus:'approved'}).allowed,false,'reviewers cannot approve without approval authority');
  const director={permissions:['content.approve','content.publish'],roleSlug:'communication_director',delegatedPublish:false,isOwner:false,domain:'content' as const};
  assert.equal(canExecuteWorkflowTransition({...director,fromStatus:'under_review',toStatus:'approved',rules:{require_editor_review:true,require_director_approval:true,allow_delegated_approval:true}}).allowed,true);
  const safe=sanitizeRichHtml('<h2>Valid title</h2><script>alert(1)</script><p onclick="bad()">Text <a href="javascript:alert(1)">link</a></p>');
  assert.match(safe,/<h2>Valid title<\/h2>/);assert.doesNotMatch(safe,/script|onclick|javascript:/i);

  const ids=[createId('art'),createId('pag'),createId('evt'),createId('pub')];
  await db.query(`INSERT INTO articles (id,slug,module,title_sw,title_en,workflow_status,status_sw,status_en,scheduled_at) VALUES ($1,'phase3-test-article','announcement','Makala','Article','scheduled','draft','draft',NOW()-INTERVAL '1 minute')`,[ids[0]]);
  await db.query(`INSERT INTO pages (id,slug,title_sw,title_en,workflow_status,status_sw,status_en,scheduled_at) VALUES ($1,'phase3-test-page','Ukurasa','Page','scheduled','draft','draft',NOW()-INTERVAL '1 minute')`,[ids[1]]);
  await db.query(`INSERT INTO events (id,slug,title_sw,title_en,start_date,workflow_status,status_sw,status_en,scheduled_at) VALUES ($1,'phase3-test-event','Tukio','Event',NOW(),'scheduled','draft','draft',NOW()-INTERVAL '1 minute')`,[ids[2]]);
  await db.query(`INSERT INTO publications (id,slug,category_slug,publication_date,title_sw,title_en,file_url,workflow_status,status_sw,status_en,scheduled_at) VALUES ($1,'phase3-test-publication','reports',CURRENT_DATE,'Ripoti','Report','/demo.pdf','scheduled','draft','draft',NOW()-INTERVAL '1 minute')`,[ids[3]]);
  assert.equal(await promoteScheduledContent(db),4,'scheduled content is promoted across all CMS collections');
  for(const table of ['articles','pages','events','publications']){
   const row=await db.query<{workflow_status:string;status_sw:string;status_en:string}>(`SELECT workflow_status,status_sw,status_en FROM ${table} WHERE workflow_status='published' AND title_en<>''`);
   assert.equal(row.rows.length,1,`${table} translation state is published alongside the scheduled content`);
   assert.equal(row.rows[0].status_sw,'published');assert.equal(row.rows[0].status_en,'published');
  }
  console.log('Phase 3 checks passed: editorial transition permissions, rich-text XSS sanitization, and scheduled publishing for articles/pages/events/publications.');
 }finally{await closeDb()}
}
main().catch(error=>{console.error('Phase 3 checks failed:',error);process.exitCode=1});
