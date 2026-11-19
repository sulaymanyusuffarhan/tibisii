import assert from 'node:assert/strict';
import { closeDb, getDb, runMigrations } from '../src/lib/db';
import { seedDatabase } from '../src/lib/seed-data';
import { getPublicShellData, getHomepageSections, getPublicArticles, getPublicArticle, getPublicEvents, getPublicEvent, getPublicPage, getPublications, getBroadcastChannels, getBroadcastSchedule, getLeadership, getPersonnel, getRegionalOffices, getFaqs, getApprovedTestimonials, searchPublicContent } from '../src/lib/public-site';

async function main(){
 process.env.DATABASE_URL='pglite://memory://';process.env.AUTO_INIT_DB='false';
 const db=await getDb();
 try{
  await runMigrations(db);await seedDatabase(db);
  const shell=await getPublicShellData();assert.ok(shell.menus.main.length>=5);assert.ok(shell.menus.utility.length>=2);
  const sections=await getHomepageSections();assert.ok(sections.length>=4);assert.ok(sections.some(section=>section.section_key==='hero'));
  await db.query(`INSERT INTO articles(id,slug,module,title_sw,excerpt_sw,body_sw,status_sw,status_en,title_en,excerpt_en,body_en,workflow_status,is_demo) VALUES('test_article','test-story','announcement','Taarifa ya mfano iliyochapishwa','Muhtasari','<p>Maudhui</p>','published','published','Published example story','Summary','<p>Content</p>','published',FALSE)`);
  await db.query(`INSERT INTO articles(id,slug,module,title_sw,excerpt_sw,body_sw,status_sw,status_en,title_en,excerpt_en,body_en,workflow_status,is_demo) VALUES('test_demo_article','test-demo-story','announcement','Taarifa ya mfano wa majaribio','Muhtasari wa majaribio','<p>Demo</p>','published','published','Demonstration example story','Demo summary','<p>Demo</p>','published',TRUE)`);
  await db.query(`INSERT INTO events(id,slug,title_sw,summary_sw,description_sw,status_sw,status_en,title_en,summary_en,description_en,start_date,workflow_status,is_demo) VALUES('test_event','test-event','Tukio la mfano','Muhtasari wa tukio','Maelezo ya tukio','published','published','Example event','Event summary','Event details','2026-05-01T10:00:00Z','published',FALSE)`);
  await db.query(`INSERT INTO publications(id,slug,category_slug,publication_date,title_sw,description_sw,status_sw,status_en,title_en,description_en,file_url,workflow_status,is_demo) VALUES('test_publication','test-publication','reports','2026-05-01','Ripoti ya mfano','Maelezo','published','published','Example report','Description','/media/docs/demo-annual-report.pdf','published',FALSE)`);
  await db.query(`INSERT INTO pages(id,slug,title_sw,summary_sw,body_sw,status_sw,status_en,title_en,summary_en,body_en,workflow_status,is_demo) VALUES('test_page','test-page','Ukurasa wa mfano','Muhtasari','<p>Maudhui</p>','published','published','Example page','Summary','<p>Content</p>','published',FALSE)`);
  await db.query(`INSERT INTO broadcast_channels(id,slug,service_type,name_sw,name_en,is_active,is_demo) VALUES('test_channel','test-channel','radio','Kituo cha mfano','Example channel',TRUE,FALSE)`);
  await db.query(`INSERT INTO broadcast_programmes(id,channel_id,title_sw,title_en,start_time,end_time,workflow_status,is_demo) VALUES('test_programme','test_channel','Kipindi cha mfano','Example programme','08:00','09:00','published',FALSE)`);
  const articles=await getPublicArticles('sw',{module:'announcement'});assert.equal(articles[0]?.slug,'test-story');assert.equal((await getPublicArticle('test-story','en'))?.title,'Published example story');
  assert.equal((await getPublicEvents('en'))[0]?.slug,'test-event');assert.equal((await getPublicEvent('test-event','en'))?.title,'Example event');
  assert.equal((await getPublicPage('test-page','en'))?.title,'Example page');assert.equal((await getPublications('en'))[0]?.slug,'test-publication');
  const channels=await getBroadcastChannels('en');assert.equal(channels[0]?.name,'Example channel');assert.equal((await getBroadcastSchedule('test_channel','en'))[0]?.title,'Example programme');
  await getLeadership('sw');await getPersonnel('sw');await getRegionalOffices('sw');await getFaqs('sw');await getApprovedTestimonials('sw');
  assert.ok((await searchPublicContent('example','en')).length>=4);
  assert.equal((await getPublicArticles('sw')).some(item=>item.slug==='test-demo-story'),false,'production public listings exclude demonstration content');
  assert.equal((await searchPublicContent('demonstration','en')).some(item=>item.slug==='test-demo-story'),false,'production search excludes demonstration content');
  console.log('Phase 4 checks passed: public shell and seeded navigation, homepage sections, bilingual published content queries, broadcast schedules, search, and production exclusion of demo content.');
 }finally{await closeDb();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
