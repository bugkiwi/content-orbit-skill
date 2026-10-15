import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
export function save(file, value, exclusive = false) {
  mkdirSync(dirname(file), { recursive: true });
  const data = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  if (exclusive) return writeFileSync(file, data, { flag: 'wx' });
  const temp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temp, data); renameSync(temp, file);
}
export function within(root, part) {
  const result = resolve(root, part), rel = relative(root, result);
  if (rel.startsWith('..' + '/') || rel === '..' || isAbsolute(rel)) throw new Error('Path escapes project root');
  return result;
}
export function files(dir, extension) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(resolve(dir, entry.name), extension) : entry.isFile() && entry.name.endsWith(extension) ? [resolve(dir, entry.name)] : []);
}
export function dateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date: ' + value);
  return value;
}
const day = z.string().refine(v => { try { dateOnly(v); return true; } catch { return false; } }, 'Invalid calendar date');
export function today(timezone, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const route = z.string().regex(/^\/(?!\/)[^?#]*$/).refine(v => !v.includes('..') && !v.includes('\\'), 'Invalid route');
const localeSchema = z.object({
  id: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/), languageCode: z.string().min(2), country: z.string().regex(/^[A-Z]{2}$/),
  locationCode: z.number().int().positive(), articleBase: route, seedKeywords: z.array(z.string().min(1)).min(1),
  internalLinks: z.array(z.object({ path: route, label: z.string().min(1) })).min(1)
}).strict();
export const configSchema = z.object({
  version: z.literal(1), name: z.string().min(1), siteUrl: z.string().url().refine(v => new URL(v).protocol === 'https:' && new URL(v).pathname === '/' && !new URL(v).search && !new URL(v).hash),
  root: z.string().default('.'), description: z.string().min(20), audience: z.string().min(5),
  author: z.string().min(1), factFiles: z.array(z.string()).min(1), exclusions: z.array(z.string()).default([]),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat('en', {timeZone:v}); return true; } catch { return false; } }),
  locales: z.array(localeSchema).min(1),
  calendar: z.object({ weekdays: z.array(z.number().int().min(0).max(6)).min(1), months: z.number().int().min(1).max(12).default(1) }),
  paths: z.object({ content: z.string().default('content/editorial'), state: z.string().default('.content-orbit-skill'), output: z.string().default('.generated/content-orbit-skill') }).default({}),
  models: z.object({ decision: z.string().default('typesafe/jev-1.13'), writer: z.string().min(1), reviewer: z.string().min(1) }),
  quality: z.object({ minScore: z.number().min(0).max(100).default(90), maxRisk: z.number().min(0).max(100).default(20), minResults: z.number().int().min(1).max(10).default(5), approval: z.enum(['manual','quality-gated']).default('quality-gated'), maxRevisions: z.number().int().min(0).max(2).default(2) }).default({}),
  maxProviderCalls: z.number().int().min(1).max(200).default(20),
  staticPages: z.array(z.object({ path: route, lastmod: day.optional() })).default([]),
  deployment: z.object({ hookEnv: z.string().regex(/^[A-Z_][A-Z0-9_]*$/).default('CONTENT_ORBIT_DEPLOY_HOOK') }).default({})
}).strict();
export function loadProject(file) {
  const configPath = resolve(file), config = configSchema.parse(readJson(configPath));
  if (new Set(config.locales.map(l=>l.id)).size !== config.locales.length) throw new Error('Duplicate locales');
  const root = resolve(dirname(configPath), config.root);
  const paths = Object.fromEntries(Object.entries(config.paths).map(([k,v])=>[k,within(root,v)]));
  const overlap = (a,b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  if (Object.values(paths).some(p => p === root || overlap(p, resolve(root, 'public')))) throw new Error('Content, state and snapshot directories must stay outside public/ and project root');
  if (overlap(paths.content, paths.state) || overlap(paths.content, paths.output) || overlap(paths.state, paths.output)) throw new Error('Content, state and output directories must be separate');
  const facts = config.factFiles.map(p => ({ path: p, text: readFileSync(within(root,p),'utf8') }));
  if (facts.some(f=>!f.text.trim() || f.text.length>250000)) throw new Error('Fact file empty or too large (250KB max per file)');
  const context = { name:config.name, siteUrl:config.siteUrl, description:config.description, audience:config.audience, author:config.author, exclusions:config.exclusions, locales:config.locales, facts };
  return { config, root, paths, context, contextHash:hash(context), configPath };
}
export function locale(project, id) {
  const result = project.config.locales.find(l=>l.id===id);
  if (!result) throw new Error('Unknown locale: ' + id); return result;
}
export async function lock(project, action) {
  mkdirSync(project.paths.state,{recursive:true});
  const path = resolve(project.paths.state,'run.lock');
  try { mkdirSync(path); } catch { throw new Error('Project is locked. Check active process before removing ' + path); }
  try { save(resolve(path,'owner.json'),{pid:process.pid,at:new Date().toISOString()}); return await action(); }
  finally { rmSync(path,{recursive:true,force:true}); }
}
export const insightSchema = z.object({ type:z.enum(['product_experience','original_framework','internal_data','experiment','real_example','expert_commentary']), summary:z.string().min(30), source:z.string().min(10), canPublish:z.literal(true) }).strict();
export const draftSchema = z.object({
  locale:z.string(), country:z.string(), date:day, updated:day, slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title:z.string().min(10).max(100), description:z.string().min(40).max(200), keyword:z.string().min(2), author:z.string().min(1),
  originalInsight:insightSchema, body:z.string().min(200)
}).strict();
export const reviewSchema = z.object({ qualityScore:z.number().min(0).max(100), riskScore:z.number().min(0).max(100), hardFailures:z.array(z.string()), reasons:z.array(z.string()).min(1), factualNotes:z.array(z.string()), languageNotes:z.array(z.string()) }).strict();
export function markdown(draft, status, reviewFile) {
  const {body,...meta}=draft; return `---\n${JSON.stringify({...meta,status,reviewFile},null,2)}\n---\n\n${body}\n`;
}
export function readArticle(file) {
  const text=readFileSync(file,'utf8'), match=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('JSON frontmatter required: '+file);
  const {status,reviewFile,...meta}=JSON.parse(match[1]);
  if (!['draft','approved'].includes(status) || typeof reviewFile!=='string') throw new Error('Invalid article state: '+file);
  return {file,status,reviewFile,draft:draftSchema.parse({...meta,body:match[2].trim()})};
}
export const articles = project => files(resolve(project.paths.content,'articles'),'.md').map(readArticle);
export const articleUrl = (project,draft) => new URL(locale(project,draft.locale).articleBase.replace(/\/$/,'')+'/'+draft.slug, project.config.siteUrl).href;
