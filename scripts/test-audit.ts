import assert from "node:assert/strict";
import {
  scorePipeline,
  scorePlatforms,
  overallScore,
  type TechnicalChecks,
} from "../src/lib/audit/engine";

const mockChecks: TechnicalChecks = {
  url: "https://example.com",
  statusCode: 200,
  responseTimeMs: 500,
  robotsTxt: {
    exists: true,
    allowsAiBots: {
      GPTBot: true,
      "OAI-SearchBot": true,
      PerplexityBot: true,
      ClaudeBot: true,
      "Google-Extended": true,
    },
    blocksAll: false,
  },
  llmsTxt: { exists: true },
  sitemap: { exists: true },
  schema: {
    hasFaqPage: true,
    hasSoftwareApplication: true,
    hasProduct: false,
    hasOrganization: true,
  },
  meta: { title: "Test", description: "Desc", hasVisibleDate: true },
  structure: {
    hasFaqSection: true,
    hasComparisonHints: true,
    hasPricingHints: true,
  },
  crawledPages: 1,
};

const pipeline = scorePipeline(mockChecks);
assert.ok(pipeline.retrieval >= 80, "retrieval score");
assert.ok(pipeline.synthesis >= 80, "synthesis score");

const platforms = scorePlatforms(mockChecks);
assert.ok(platforms.chatgpt > 0);
assert.ok(platforms.google_aio > 0);

const overall = overallScore(pipeline);
assert.ok(overall >= 70 && overall <= 100);

console.log("audit self-check ok", { pipeline, platforms, overall });
