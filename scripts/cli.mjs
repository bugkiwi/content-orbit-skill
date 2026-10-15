#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { config as dotenv } from 'dotenv';
import { loadProject, locale, lock, save, readJson, within, today, hash } from './core.mjs';
import { providers } from './providers.mjs';
import { readTrends, judge, normalizeKeywords, normalizeResearch } from './mining.mjs';
import { calendar, plan, brief, generate, qa, approve, rereview, batch } from './editorial.mjs';
import { prepare, deploy, verify } from './release.mjs';

const help=`Content Orbit Skill — Node 22+
Usage: content-orbit-skill <command> --project /path/project.json [options]
  doctor                         Validate project and show credential presence (never values)
  slots [--from DATE --months N]  Read-only publication gaps; drafts reserve dates
  trends --locale ID --input CSV_OR_HTTPS_RSS [--threshold .75 --top 10 --dry-run]
  keywords --locale ID [--seeds 'one|two' --limit 50]  DataForSEO Labs + JEV
  research --locale ID --keyword TEXT               DataForSEO live SERP
  plan --input OPPORTUNITIES_JSON [--from DATE --months N]
  brief --input BRIEF_INPUT_JSON --research RESEARCH_JSON
  generate --brief BRIEF_JSON     Write + independently review; preserve occupied dates
  batch [--limit 3]               Generate missing articles from prepared briefs, date order
  review --article MARKDOWN       Explicit re-review after edits; clears manual approval
  approve --article MARKDOWN --by NAME --note TEXT   Explicit content approval
  qa                             Offline hashes, evidence, links and approval gates
  release [--deploy] [--retry-deploy]                Build due snapshot + sitemap
  verify [--base-url HTTPS_URL]   Check deployed sitemap and article/future 404 statuses
Options: --env FILE (default project-root/.env); --output FILE (mining/research only)
All commands print JSON. Files passed to --input/--brief/--research/--article are
resolved from the shell cwd; generated data paths come from the selected project.
No credentials are needed for dry-run, slots, plan, brief, qa or local release.`;
function number(raw,fallback,min,max,integer=true) {
  const value=raw===undefined?fallback:Number(raw);
  if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))) throw new Error(`Number must be ${min}..${max}`);
  return value;
}
async function main() {
  const {values:v,positionals}=parseArgs({allowPositionals:true,options:Object.fromEntries([
    ...['project','env','locale','input','output','from','months','threshold','top','seeds','limit','keyword','research','brief','article','by','note','base-url'].map(k=>[k,{type:'string'}]),
    ...['help','dry-run','deploy','retry-deploy'].map(k=>[k,{type:'boolean'}])
  ])});
  const command=positionals[0];
  if(v.help||!command){console.log(help);return;}
  if(positionals.length!==1||!v.project) throw new Error('Specify one command and --project FILE');
  if(v['dry-run']&&command!=='trends') throw new Error('--dry-run is supported only by trends');
  if((v.deploy||v['retry-deploy'])&&command!=='release') throw new Error('Deployment flags are supported only by release');
  if(v.output&&!['trends','keywords','research'].includes(command)) throw new Error('--output is supported only by mining/research commands');
  const p=loadProject(v.project);dotenv({path:v.env?resolve(v.env):resolve(p.root,'.env')});
  const need=k=>{if(!v[k]) throw new Error('Missing --'+k);return v[k];};
  const inputPath=k=>within(p.root,resolve(need(k)));
  const api=providers(p);
  const store=(kind,data)=>{
    const file=v.output?within(p.root,resolve(v.output)):resolve(p.paths.content,kind,v.locale??'all',today(p.config.timezone)+'-'+hash(data).slice(0,12)+'.json');
    if(v.input&&file===resolve(v.input)) throw new Error('Output cannot overwrite input');
    save(file,data);return {file,...data};
  };
  const run=async()=>{
    switch(command) {
      case 'doctor':return {name:p.config.name,root:p.root,timezone:p.config.timezone,locales:p.config.locales.map(l=>l.id),approval:p.config.quality.approval,models:p.config.models,credentials:{openrouter:!!process.env.OPENROUTER_API_KEY,dataforseo:!!process.env.DATAFORSEO_LOGIN&&!!process.env.DATAFORSEO_PASSWORD,deployHook:!!process.env[p.config.deployment.hookEnv]}};
      case 'slots':return {slots:calendar(p,v.from,number(v.months,p.config.calendar.months,1,12))};
      case 'trends':{
        const market=locale(p,need('locale')),source=need('input');
        const inferred=/^https:\/\//i.test(source)?new URL(source).searchParams.get('geo'):source.match(/trending_([a-z]{2})_/i)?.[1];
        if(inferred&&inferred.toUpperCase()!==market.country) throw new Error('Trend source geo conflicts with locale');
        const rows=await readTrends(source);
        if(v['dry-run'])return {locale:market.id,count:rows.length,rows};
        return store('opportunities',{...await judge(p,api,rows,market.id,{threshold:number(v.threshold,.75,0,1,false),top:number(v.top,10,1,100)}),source,sourceType:'trends'});
      }
      case 'keywords':{
        const market=locale(p,need('locale')),seeds=v.seeds?v.seeds.split('|').map(s=>s.trim()).filter(Boolean):market.seedKeywords;
        if(!seeds.length||seeds.length>200) throw new Error('Supply 1..200 seed keywords');
        const result=await api.dataforseo('dataforseo_labs/google/keyword_ideas/live',{keywords:seeds,location_code:market.locationCode,language_code:market.languageCode,limit:number(v.limit,50,1,200)},today(p.config.timezone));
        const rawFile=resolve(p.paths.content,'research','raw',hash(result.data)+'.json');save(rawFile,result);
        return store('opportunities',{...await judge(p,api,normalizeKeywords(result.data),market.id,{threshold:number(v.threshold,.75,0,1,false),top:number(v.top,10,1,100)}),sourceType:'dataforseo-keywords',rawFile});
      }
      case 'research':{
        const market=locale(p,need('locale')),keyword=need('keyword');
        const result=await api.dataforseo('serp/google/organic/live/advanced',{keyword,language_code:market.languageCode,location_code:market.locationCode,depth:10,device:'desktop',os:'windows'},today(p.config.timezone));
        save(resolve(p.paths.content,'research','raw',hash(result.data)+'.json'),result);
        return store('research',normalizeResearch(result,keyword,market));
      }
      case 'plan':return plan(p,readJson(inputPath('input')),v.from,number(v.months,p.config.calendar.months,1,12));
      case 'brief':{const rf=inputPath('research');return {file:brief(p,readJson(inputPath('input')),readJson(rf),rf)};}
      case 'generate':return generate(p,api,inputPath('brief'));
      case 'batch':return batch(p,api,number(v.limit,3,1,20));
      case 'review':return rereview(p,api,inputPath('article'));
      case 'approve':return approve(p,inputPath('article'),need('by'),need('note'));
      case 'qa':return qa(p);
      case 'release':{if(v['retry-deploy']&&!v.deploy)throw new Error('--retry-deploy requires --deploy');const result=prepare(p);return v.deploy?{...result,deployment:await deploy(p,result,{retry:!!v['retry-deploy']})}:result;}
      case 'verify':return verify(p,v['base-url']);
      default:throw new Error('Unknown command; use --help');
    }
  };
  const result=['doctor','slots','verify'].includes(command)||(command==='trends'&&v['dry-run'])?await run():await lock(p,run);
  console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{const secrets=[process.env.OPENROUTER_API_KEY,process.env.DATAFORSEO_LOGIN,process.env.DATAFORSEO_PASSWORD,process.env.CONTENT_ORBIT_DEPLOY_HOOK].filter(Boolean);let message=error instanceof Error?error.message:'Content Orbit Skill failed';for(const secret of secrets)message=message.replaceAll(secret,'[REDACTED]');console.error(message);process.exitCode=1;});
