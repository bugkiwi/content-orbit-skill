import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { articles, articleUrl, hash, save, readJson, today } from './core.mjs';
import { qa, validateArticle } from './editorial.mjs';
import { http, boundedText } from './providers.mjs';

const escapeXml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function sitemap(project,published) {
  const entries=[...project.config.staticPages.map(p=>({url:new URL(p.path,project.config.siteUrl).href,lastmod:p.lastmod})),...published.map(a=>({url:a.url,lastmod:a.updated}))];
  if(new Set(entries.map(p=>p.url)).size!==entries.length) throw new Error('Duplicate sitemap URL');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entries.map(p=>`  <url><loc>${escapeXml(p.url)}</loc>${p.lastmod?`<lastmod>${p.lastmod}</lastmod>`:''}</url>`).join('\n')+'\n</urlset>\n';
}
export function prepare(project,now=new Date()) {
  qa(project);const cutoff=today(project.config.timezone,now),rows=articles(project);
  const eligible=rows.filter(a=>a.status==='approved'&&a.draft.date<=cutoff&&a.draft.updated<=cutoff);
  const published=eligible.map(a=>{
    validateArticle(project,a,{requireApproved:true});
    const d=a.draft;return {locale:d.locale,country:d.country,slug:d.slug,title:d.title,description:d.description,date:d.date,updated:d.updated,author:d.author,body:d.body,url:articleUrl(project,d)};
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.url.localeCompare(b.url));
  const xml=sitemap(project,published),payload={version:1,project:project.config.name,articles:published};
  const releaseId=hash({payload,sitemap:xml}),dir=resolve(project.paths.output,'releases',releaseId),currentFile=resolve(project.paths.output,'current.json');
  const prior=existsSync(currentFile)?readJson(currentFile):null;
  mkdirSync(resolve(project.paths.output,'releases'),{recursive:true});
  if(!existsSync(dir)) {
    const temp=resolve(project.paths.output,'releases','.'+randomUUID()+'.tmp');mkdirSync(temp);
    save(resolve(temp,'articles.json'),payload);save(resolve(temp,'sitemap.xml'),xml);
    save(resolve(temp,'release.json'),{version:1,releaseId,builtAt:now.toISOString(),cutoff,timezone:project.config.timezone,articleCount:published.length});
    renameSync(temp,dir);
  }
  save(currentFile,{version:1,releaseId,directory:relative(project.paths.output,dir),articleCount:published.length});
  const future=rows.filter(a=>a.status==='approved'&&(a.draft.date>cutoff||a.draft.updated>cutoff));
  save(resolve(project.paths.state,'schedule.json'),{checkedAt:now.toISOString(),timezone:project.config.timezone,cutoff,releaseId,nextDates:[...new Set(future.map(a=>[a.draft.date,a.draft.updated].sort().at(-1)))].sort()});
  return {releaseId,directory:dir,changed:prior?.releaseId!==releaseId,cutoff,published:published.length,scheduled:future.length,drafts:rows.filter(a=>a.status==='draft').length};
}
export async function deploy(project,release,{retry=false,request=http}={}) {
  const file=resolve(project.paths.state,'deployments',release.releaseId+'.json');
  if(existsSync(file)&&!retry) return {...readJson(file),skipped:true,note:'Already attempted; request acknowledgement does not prove production Ready. Inspect host before explicit --retry-deploy.'};
  const hook=process.env[project.config.deployment.hookEnv];
  if(!hook) throw new Error('Missing deployment hook env: '+project.config.deployment.hookEnv);
  let u;try {u=new URL(hook);} catch {throw new Error('Invalid deploy hook URL (redacted)');}
  if(u.protocol!=='https:') throw new Error('Deploy hook requires HTTPS');
  const record={releaseId:release.releaseId,status:'intent',requestedAt:new Date().toISOString()};
  save(file,record);
  try {
    const response=await request(u,{method:'POST',signal:AbortSignal.timeout(30000),redirect:'error'});
    record.httpStatus=response.status;record.status=response.ok?'requested':'failed';save(file,record);
    if(!response.ok) throw new Error('Deployment hook rejected request');
    return {...record,note:'Hook accepted. Check host build/Ready and run verify against production; no publication success asserted.'};
  } catch(error) {
    if(record.status==='intent') {record.status='unknown';save(file,record);}
    throw new Error(`Deployment ${record.status}; inspect hosting console before retry (hook URL redacted)`);
  }
}
export async function verify(project,baseUrl=project.config.siteUrl,request=http) {
  const current=readJson(resolve(project.paths.output,'current.json'));
  const publicData=readJson(resolve(project.paths.output,current.directory,'articles.json'));
  const response=await request(new URL('/sitemap.xml',baseUrl),{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok) throw new Error('Live sitemap HTTP '+response.status);
  const xml=await boundedText(response),parsed=new XMLParser().parse(xml);
  const entries=parsed.urlset?.url,rows=entries===undefined?[]:Array.isArray(entries)?entries:[entries];
  const live=new Set(rows.map(e=>e.loc)),expected=new Set([...project.config.staticPages.map(p=>new URL(p.path,project.config.siteUrl).href),...publicData.articles.map(a=>a.url)]);
  if(live.size!==expected.size||[...expected].some(u=>!live.has(u))) throw new Error('Live sitemap differs from current release');
  let checked=0;
  for(const article of articles(project)) {
    const url=articleUrl(project,article.draft),isPublic=publicData.articles.some(a=>a.url===url);
    const page=await request(new URL(new URL(url).pathname,baseUrl),{signal:AbortSignal.timeout(30000),redirect:'manual'});
    const status=page.status;await page.body?.cancel();
    if(isPublic?status!==200:status!==404) throw new Error(`Live article status ${status}, expected ${isPublic?200:404}: ${new URL(url).pathname}`);
    checked++;
  }
  return {verifiedAt:new Date().toISOString(),releaseId:current.releaseId,articleRoutesChecked:checked,sitemapUrls:expected.size,note:'Observed HTTP status and sitemap parity; not proof of indexing, content rendering or deployment provider Ready.'};
}
