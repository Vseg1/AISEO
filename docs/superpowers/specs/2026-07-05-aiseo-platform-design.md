# AISEO Platform — Design Spec

**Date:** 2026-07-05  
**Status:** Approved for implementation

## Vision

SaaS platform where users register a website/webapp/SaaS solution and improve AI agent visibility through audit, recommendations, asset generation, and monitoring.

**Promise:** Measure and improve *agent share of voice* — not guaranteed #1 ranking.

## Stack

- Next.js 15 App Router + TypeScript + shadcn/ui
- Neon Postgres + Drizzle ORM
- Auth.js v5 (Google OAuth + email magic link)
- Cheerio for site crawl
- OpenAI API (generation + ChatGPT monitoring)
- Perplexity API + SerpAPI (monitoring)
- Vercel hosting + Cron

## Modules

1. **Onboarding** — 4-step wizard (identity, positioning, competitors, target queries)
2. **Audit Engine** — technical + semantic checks, pipeline/Tier scores
3. **Recommendation Engine** — gap → action rules from Tier playbook
4. **Asset Generator** — llms.txt, JSON-LD, FAQ, comparison drafts, robots.txt
5. **Visibility Monitor** — scheduled query runs, share of voice vs competitors

## Data Model

- `solutions` — user-owned product profiles
- `target_queries`, `competitors` — linked to solutions
- `audits` — crawl results and scores
- `recommendations` — actionable items with status
- `generated_assets` — exported content
- `visibility_runs`, `visibility_results` — monitoring history

## Authorization

Application-level `userId` filtering on all queries (no Postgres RLS in v1).

## Tier Priority (monitoring & recommendations)

1. Google AI Overviews + Gemini
2. ChatGPT (browse)
3. Perplexity
4. Claude, Copilot (Tier 2)

## Out of Scope v1

- Auto-deploy to client sites
- Mobile apps without public URL
- Guaranteed ranking promises
