import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadProject, save, readJson, hash, markdown, today, dateOnly, lock, articles } from '../scripts/core.mjs';
import { calendar, brief, generate, approve, qa, deterministic, validateResearch, batch, plan } from '../scripts/editorial.mjs';
import { prepare, deploy, verify } from '../scripts/release.mjs';
import { parseCsv, parseRss, parseDecisions, normalizeKeywords, judge } from '../scripts/mining.mjs';
import { providers } from '../scripts/providers.mjs';

const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
function fixture(t,{approval='quality-gated'}={}) {
  const root=mkdtempSync(resolve(tmpdir(),'content-orbit-skill-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const config=JSON.parse(readFileSync(resolve(repo,'examples/project.json'),'utf8'));
  config.quality.approval=approval;config.locales=config.locales.slice(0,1);config.maxProviderCalls=20;
  save(resolve(root,'project.json'),config);save(resolve(root,'product-facts.md'),'Example Project helps people plan a useful story. No paid or clinical promises.');
  return loadProject(resolve(root,'project.json'));
}
const research=(p,keyword='story planning')=>({kind:'research',provider:'manual-web-search',locale:'en',country:'US',keyword,retrievedAt:'2026-10-15T00:00:00Z',rankingsLocationLocked:false,results:Array.from({length:5},(_,i)=>({title:'Actual result '+i,url:'https://example.org/result-'+i,position:null}))});
const input=date=>({locale:'en',date,keyword:'story planning',intent:'Find actionable ways to prepare a useful story.',reader:'People preparing a personal story',originalInsight:{type:'original_framework',summary:'Choose one concrete moment, explain the change, then name the message you want to preserve.',source:'Original editorial framework grounded in product-facts.md; not a measured experiment.',canPublish:true},outline:['Choose one real moment','Use the product to organize the message'],sources:[],notes:''});
function makeBrief(p,date) {
  const r=research(p),file=resolve(p.paths.content,'research',date+'.json');save(file,r);return brief(p,input(date),r,file);
}
function draft(b) {
  return {locale:b.locale,country:'US',date:b.date,updated:b.date,slug:'story-'+b.date,title:'How to prepare one useful story',description:'Choose one moment and one message to prepare a clear story for the product workflow.',keyword:b.keyword,author:'Example Project',originalInsight:b.originalInsight,body:'# How to prepare one useful story\n\nStart with a real scene you can describe clearly. Keep one message at the center, then choose details that explain it. This is an illustrative framework, rather than a measured experiment.\n\n## Choose the details\n\nWrite what happened and why you remember it. Visit the [product overview](/) to see the next step.'};
}
function fakeApi({score=94}={}) {
  const calls=[];
  return {calls,async json(model,instructions,data) { calls.push(data);return {value:instructions.startsWith('Write')?draft(data.brief):{qualityScore:score,riskScore:10,hardFailures:[],reasons:['Useful native-language advice supported by the supplied project facts.'],factualNotes:[],languageNotes:[]},call:{requestedModel:model,actualModel:model,responseId:'fixture',usage:null}};}};
}

test('CSV/RSS normalize duplicates; reject external entities and insecure feeds',async()=>{
  const rows=parseCsv('\uFEFF趋势,搜索量,趋势细分\nPapa,100+,"gift,dad"\npapa,50+,\n');assert.equal(rows.length,1);assert.equal(rows[0].searchVolume,null);assert.equal(rows[0].traffic,'100+');
  assert.equal(parseRss('<rss><channel><item><title>papà</title><ht:approx_traffic>200+</ht:approx_traffic></item></channel></rss>')[0].term,'papà');
  assert.throws(()=>parseRss('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>'));
});
test('JEV requires complete distributions and distinguishes article from feature probability',async t=>{
  const p=fixture(t),rows=parseCsv('keyword\nplanning\n');
  const answers={term_1:{type:'choice',choice:'feature',probabilities:{article:.05,feature:.85,both:.02,adjacent:.04,unrelated:.03,needs_context:.01}}};
  assert.equal(parseDecisions(answers,rows)[0].articleProbability,.07);
  assert.throws(()=>parseDecisions({},rows));
  assert.throws(()=>parseDecisions({term_1:{...answers.term_1,probabilities:{article:1}}},rows));
  const report=await judge(p,{decisions:async()=>({data:{answers,model:'typesafe/jev-1.13'},cached:false})},rows,'en',{threshold:.75});assert.equal(report.selected.length,1);assert.equal(report.selected[0].classification,'feature');
});
test('DataForSEO missing metrics stay unknown; real zero is preserved',()=>{
  const rows=normalizeKeywords({tasks:[{result:[{items:[{keyword:'first',keyword_info:{search_volume:0,cpc:0}},{keyword:'second'}]}]}]});
  assert.equal(rows[0].searchVolume,0);assert.equal(rows[1].searchVolume,null);assert.equal(rows[0].keywordDifficulty,null);
});
test('planning excludes feature-only ideas, preserves prior plan and never pads missing slots',t=>{
  const p=fixture(t),report={kind:'opportunities',contextHash:p.contextHash,locale:'en',threshold:.75,all:[{term:'feature',classification:'feature',articleProbability:.9,needsVerification:false},{term:'story planning',classification:'article',articleProbability:.85,needsVerification:false}]};
  const a=plan(p,report,'2026-10-14',1);assert.equal(a.added.length,1);assert.equal(a.added[0].keyword,'story planning');assert.ok(a.missing.length>0);
  const before=readFileSync(a.path,'utf8');assert.equal(plan(p,report,'2026-10-14',1).added.length,0);assert.equal(readFileSync(a.path,'utf8'),before);
});
test('calendar uses explicit timezone and month-end boundaries',t=>{
  const p=fixture(t);assert.equal(today('Asia/Shanghai',new Date('2026-10-14T16:01:00Z')),'2026-10-15');assert.throws(()=>dateOnly('2026-02-30'));
  const slots=calendar(p,'2026-01-31',1);assert.ok(slots.every(s=>s.date>='2026-01-31'&&s.date<'2026-02-28'));
});
test('evidence gate rejects missing distinct results and falsely location-locked fallback',t=>{
  const p=fixture(t),r=research(p);r.results=r.results.slice(0,4);assert.throws(()=>validateResearch(p,r,'en','story planning'));
  const other=research(p);other.rankingsLocationLocked=true;assert.throws(()=>validateResearch(p,other,'en','story planning'));
});
test('future article bodies, metadata and URLs stay absent until due; sitemap moves with snapshot',async t=>{
  const p=fixture(t),api=fakeApi();await generate(p,api,makeBrief(p,'2026-10-14'));await generate(p,api,makeBrief(p,'2026-10-16'));
  const first=prepare(p,new Date('2026-10-14T16:00:00Z')),data=readJson(resolve(first.directory,'articles.json')),xml=readFileSync(resolve(first.directory,'sitemap.xml'),'utf8');
  assert.equal(first.published,1);assert.equal(first.scheduled,1);assert.ok(!JSON.stringify(data).includes('story-2026-10-16'));assert.ok(!xml.includes('story-2026-10-16'));
  assert.equal(prepare(p,new Date('2026-10-15T10:00:00Z')).changed,false);
  const next=prepare(p,new Date('2026-10-15T16:00:00Z'));assert.equal(next.published,2);assert.notEqual(next.releaseId,first.releaseId);
  const current=readJson(resolve(p.paths.output,'current.json'));assert.equal(current.releaseId,next.releaseId);
});
test('drafts reserve calendar slots, generation skips without extra calls, manual approval required',async t=>{
  const p=fixture(t,{approval:'manual'}),api=fakeApi(),bf=makeBrief(p,'2026-10-14'),result=await generate(p,api,bf);
  assert.equal(result.status,'draft');assert.equal(prepare(p,new Date('2026-10-15')).published,0);
  const calls=api.calls.length;assert.ok((await generate(p,api,bf)).skipped);assert.equal(api.calls.length,calls);
  assert.equal(calendar(p,'2026-10-14',1).find(s=>s.date==='2026-10-14').occupied,true);
  approve(p,result.articleFile,'owner','Explicitly approved this exact article for publication.');assert.equal(prepare(p,new Date('2026-10-15')).published,1);
});
test('edited body or metadata invalidates review, and changed facts invalidate briefs',async t=>{
  const p=fixture(t),result=await generate(p,fakeApi(),makeBrief(p,'2026-10-14'));
  const original=readFileSync(result.articleFile,'utf8');save(result.articleFile,original.replace('clear story','different story'));assert.throws(()=>qa(p),/Stale review hash/);
  save(result.articleFile,original);save(resolve(p.root,'product-facts.md'),'Changed product capabilities with different supported conditions.');const changed=loadProject(p.configPath);assert.throws(()=>qa(changed),/context or research changed/);
});
test('unapproved low scores cannot be forced through manual approval',async t=>{
  const p=fixture(t),api=fakeApi({score:80}),result=await generate(p,api,makeBrief(p,'2026-10-14'));
  assert.equal(result.status,'draft');assert.equal(api.calls.length,6);assert.throws(()=>approve(p,result.articleFile,'owner','Publish anyway'),/gates/);assert.equal(prepare(p,new Date('2026-10-15')).published,0);
});
test('future updated date also delays release and native link registry rejects invented links',async t=>{
  const p=fixture(t),b=input('2026-10-14'),d=draft(b);d.body+='\n[Unsupported link](/future-page)';assert.ok(deterministic(p,d,b).some(f=>f.includes('registry')));
  const api=fakeApi();const prior=api.json;api.json=async(...args)=>{const r=await prior(...args);if(args[1].startsWith('Write'))r.value.updated='2026-10-18';return r;};
  await generate(p,api,makeBrief(p,'2026-10-14'));assert.equal(prepare(p,new Date('2026-10-15')).published,0);
});
test('project lock blocks concurrent mutations and is released on failure',async t=>{
  const p=fixture(t);await lock(p,async()=>{await assert.rejects(lock(p,async()=>{}),/locked/);});
  await assert.rejects(lock(p,async()=>{throw new Error('fixture');}));assert.ok(!existsSync(resolve(p.paths.state,'run.lock')));
});
test('scheduled batch consumes prepared briefs in date order, bounded by limit',async t=>{
  const p=fixture(t),api=fakeApi();makeBrief(p,'2026-10-16');makeBrief(p,'2026-10-14');
  const first=await batch(p,api,1);assert.equal(first.results.length,1);assert.equal(first.pending,1);assert.equal(articles(p)[0].draft.date,'2026-10-14');
  const next=await batch(p,api,1);assert.equal(next.results.length,1);assert.equal(next.pending,0);const count=api.calls.length;assert.equal((await batch(p,api,3)).results.length,0);assert.equal(api.calls.length,count);
});
test('live verification checks published statuses and rejects future exposure',async t=>{
  const p=fixture(t),api=fakeApi();await generate(p,api,makeBrief(p,'2026-10-14'));await generate(p,api,makeBrief(p,'2026-10-16'));
  const release=prepare(p,new Date('2026-10-15')),xml=readFileSync(resolve(release.directory,'sitemap.xml'),'utf8');
  const request=async url=>new Response(new URL(url).pathname==='/sitemap.xml'?xml:'',{status:new URL(url).pathname.includes('2026-10-16')?404:200});
  assert.equal((await verify(p,'https://example.com',request)).articleRoutesChecked,2);
  await assert.rejects(verify(p,'https://example.com',async url=>new Response(new URL(url).pathname==='/sitemap.xml'?xml:'',{status:200})),/expected 404/);
});
test('deployment intent is durable; lost response is not automatically posted again',async t=>{
  const p=fixture(t),release=prepare(p,new Date('2026-10-15'));process.env.CONTENT_ORBIT_DEPLOY_HOOK='https://deploy.example/hook-secret';t.after(()=>delete process.env.CONTENT_ORBIT_DEPLOY_HOOK);let calls=0;
  const request=async()=>{calls++;throw new Error('timeout');};await assert.rejects(deploy(p,release,{request}),/unknown/);
  const retried=await deploy(p,release,{request});assert.equal(retried.skipped,true);assert.equal(calls,1);assert.ok(!JSON.stringify(retried).includes('hook-secret'));
});
test('provider cache reuses successful requests, requires explicit model and validates call budget',async t=>{
  const p=fixture(t);process.env.OPENROUTER_API_KEY='fixture-secret';t.after(()=>delete process.env.OPENROUTER_API_KEY);let calls=0;
  const api=providers(p,async()=>{calls++;return new Response(JSON.stringify({id:'fixture',model:'fixture-model',choices:[{finish_reason:'stop',message:{content:'{"answer":1}'}}]}),{status:200});});
  const a=await api.json('fixture-model','test',{q:1}),b=await api.json('fixture-model','test',{q:1});assert.equal(a.value.answer,1);assert.equal(b.call.cached,true);assert.equal(calls,1);await assert.rejects(api.json('typesafe/jev-1.13','test',{}),/decision model/);
  p.config.maxProviderCalls=1;await assert.rejects(api.json('fixture-model','test',{q:2}),/budget/);assert.equal(calls,1);
});
test('CLI planning/build smoke works without credentials and projects remain isolated',t=>{
  const p=fixture(t),q=fixture(t);const cli=resolve(repo,'scripts/cli.mjs');
  const run=cmd=>JSON.parse(execFileSync(process.execPath,[cli,cmd,'--project',p.configPath],{encoding:'utf8',env:{PATH:process.env.PATH}}));
  assert.equal(run('doctor').credentials.openrouter,false);assert.ok(run('slots').slots.length>0);assert.equal(run('release').published,0);assert.ok(!existsSync(q.paths.output));
  assert.throws(()=>execFileSync(process.execPath,[cli,'release','--project',p.configPath,'--dry-run'],{encoding:'utf8',stdio:'pipe'}));
});
