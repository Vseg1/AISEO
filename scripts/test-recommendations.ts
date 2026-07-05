import assert from "node:assert/strict";
import { buildRecommendations } from "../src/lib/recommendations/rules";
import type { TechnicalChecks } from "../src/lib/audit/engine";

const emptyChecks: TechnicalChecks = {
  url: "https://example.com",
  statusCode: 200,
  responseTimeMs: 500,
  robotsTxt: {
    exists: false,
    allowsAiBots: { GPTBot: true, "OAI-SearchBot": true, PerplexityBot: false, ClaudeBot: true, "Google-Extended": true },
    blocksAll: false,
  },
  llmsTxt: { exists: false },
  sitemap: { exists: false },
  schema: { hasFaqPage: false, hasSoftwareApplication: false, hasProduct: false, hasOrganization: false },
  meta: { hasVisibleDate: false },
  structure: { hasFaqSection: false, hasComparisonHints: false, hasPricingHints: false },
  crawledPages: 1,
};

const recs = buildRecommendations(emptyChecks);
assert.ok(recs.length >= 5, "recommendations generated");
assert.ok(recs.some((r) => r.tier === "perplexity"));
console.log("recommendations self-check ok", recs.length);
