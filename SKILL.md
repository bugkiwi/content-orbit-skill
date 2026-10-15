---
name: content-orbit-skill
description: Research and generate project-specific SEO/GEO articles on a recurring editorial calendar using DataForSEO and CSV/RSS trend mining, then validate dated release snapshots and sitemap updates. Use for onboarding a project, finding content opportunities, preparing article batches, or operating an existing publication schedule.
---

# Content Orbit Skill

Work against **one explicitly selected project configuration** per command. This skill is the editorial operator; bundled scripts provide deterministic storage, provider adapters, quality gates and release artifacts. They do not install a scheduler, integrate a website or authorize deployment just by being invoked.

Read [README.md](README.md) for setup/commands; use [references/workflow.md](references/workflow.md) for stage handoffs and failure recovery. Read [references/research-writing.md](references/research-writing.md) when mining or writing, and [references/publication.md](references/publication.md) when integrating or releasing. Do not load every reference for a narrow task.

## Select the project and work

Find the project configuration named by the user; otherwise inspect the specified repository and create `content-orbit-skill.project.json` there using `examples/project.json`. Read that repository's instructions and current product/policy implementation. Confirm facts through code or current authoritative sources, then maintain a concise facts file. Keep project-specific brand, language, pricing, routes, cadence, models and time zone in configuration, not this skill. Keep example configuration separate from verified facts for the selected project.

Use the existing framework/CMS rather than restructuring it. New-project setup may create editorial files and an integration proposal; activate remote schedules, publish or deploy only within the user's actual authorization. Existing authorization carries forward; do not add repeated confirmation to an already authorized workflow. Do not send outreach or create external posts from a research/generation request.

CLI: `node /path/to/content-orbit-skill/scripts/cli.mjs COMMAND --project /absolute/project/config.json`. The skill's own Node dependencies must be installed. Run `doctor` and `slots` first. Default horizon is one calendar month in the configured time zone; preserve every occupied locale/date, including drafts. If covered, stop without paid calls. An explicit period, locale, topic or maintenance request overrides defaults.

## Discover and plan

Use `keywords` for DataForSEO Labs ideas and `trends` for a local Trends CSV or HTTPS RSS. JEV only decides relevance; use a text model for briefs/articles. Inspect actual intent and ambiguities before selecting an opportunity. Native class probability is not conversion probability, demand or a ranking guarantee. Feature-only results do not enter article plans; record them separately without implementing features.

Run `plan` on the opportunity report. Do not fill the calendar with unrelated topics when candidates run out. Compare proposed intent against existing articles and product pages; merge overlapping questions or choose a genuinely distinct angle. A planned date is not an approved article.

For each selected topic run `research`, then inspect actual results and useful competitor headings. DataForSEO failures are not silently retried or replaced with imaginary data. A real connected web-search fallback is acceptable: save the research schema described in the research reference, disclose unlocked rankings, and leave unavailable volume/KD/CPC as `null`. Require the configured minimum of distinct actual results. News titles and snippets are clues, not verified facts.

## Brief, write and review

Gather one real, publishable original insight: product experience, a framework labeled as advice, permissioned data, a real example or a documented experiment. Never invent tests, quotations or customer outcomes to satisfy a quota. Read primary sources for external factual, comparative or local holiday claims; record URL, supported facts, verification time and whether the verifier was an agent or human.

Author a **native** brief input from `examples/brief-input.json` and run `brief --input ... --research ...`. Keep outline, intent, insight and evidence specific. Independent native articles are not translated counterparts. Seasonal lead time is a project/editorial decision; verify the country/year and choose a useful date rather than importing a universal holiday rule.

Run `generate --brief ...`, or `batch` for already prepared briefs. The text model drafts and a separate model call reviews; the reviewer may be the same configured model and is not a human. Revisions are bounded by configuration (at most two). Read the resulting article, not just its score; sample every language and inspect all sensitive/dated claims. Retain attempts and actual requested/returned models. Do not replace the configured model silently or adjust scores to obtain approval.

Run `qa`. A changed body/metadata, brief, research or project facts invalidates prior review. A failed draft reserves its date and remains draft. For requested maintenance, preserve the old evidence/review, update the brief when needed, and run `review --article ...`; this clears manual approval. `approve` records an explicit authorized decision on the exact passing article and cannot bypass factual/quality gates. Do not label agent review or ordinary user acceptance as professional native-human review.

## Release and measure

`release` locally builds approved articles whose publication **and update dates** are due, plus a sitemap from those same articles and configured static pages. It does not deploy by default. For website integration enforce the invariants in the publication reference: all public routes, metadata/schema, lists, related links, feeds and sitemap consume only that snapshot. Future/raw Markdown must never be read by public requests or exposed through bundles, date parameters or fallback routes.

Writing future Markdown does not install timed release. Use a configured CI/host scheduler for recurring generation and release, with a build on the website's production source revision. Generation requires an agent to research/prepare new briefs, or a pre-prepared pool for the scheduled `batch` command. The sample weekly CI mines/plans and drafts prepared briefs into a PR; it cannot verify new primary evidence on its own. Follow the explicit setup steps in README, including main-branch content availability and a site build adapter.

When deployment is authorized and configured, `release --deploy` sends the hook only once per release ID using a persistent intent ledger. A timeout is unknown, not a failed build or permission to repost. Inspect the host and use an explicit retry only after resolving the prior attempt. A hook acknowledgement is not a Ready deployment. Check the host, then `verify` against production. Report precisely what was observed. Do not claim indexing, rankings, AI citations or conversions without evidence.

For ongoing improvement, connect real GSC/analytics data and fixed native buyer questions to topic updates. Track brand mention and cited URL separately; native model self-assessments are not observations of search engines. Prefer refreshing useful pages over blindly increasing volume.

Finish with project/period, generated/skipped/draft/scheduled counts, costs actually reported, QA results, deployment state if requested, and remaining research or integration blockers. Link produced artifacts. Never print environment variable values, hook URLs or private customer material.
