import assert from "node:assert/strict";
import { generateAuditReport } from "../src/lib/generate/audit-report";
import type { TechnicalChecks } from "../src/lib/audit/engine";

const mock = {
  solution: {
    name: "WedApp",
    url: "https://wedapp.example.com",
    type: "webapp",
    language: "fr",
    description: "Organisation de mariage",
    category: "Wedding",
    markets: ["France"],
    personas: ["Couples"],
    useCases: ["Planning mariage"],
    integrations: [],
  },
  audit: {
    overallScore: 27,
    ranAt: new Date("2026-07-06"),
    pipelineScores: { retrieval: 30, scoring: 25, synthesis: 26 },
    platformScores: { google_aio: 28, chatgpt: 25, perplexity: 22 },
    semanticScores: { "meilleur outil mariage": 45 },
    technicalChecks: {
      url: "https://wedapp.example.com",
      statusCode: 200,
      responseTimeMs: 400,
      robotsTxt: {
        exists: false,
        allowsAiBots: { GPTBot: false } as Record<string, boolean>,
        blocksAll: false,
      },
      llmsTxt: { exists: false },
      sitemap: { exists: false },
      schema: {
        hasFaqPage: false,
        hasSoftwareApplication: false,
        hasProduct: false,
        hasOrganization: false,
      },
      meta: { description: "Test", hasVisibleDate: false },
      structure: {
        hasFaqSection: false,
        hasComparisonHints: false,
        hasPricingHints: false,
      },
      crawledPages: 3,
    } as TechnicalChecks,
  },
  queries: ["meilleur outil organisation mariage"],
  competitors: [{ name: "Zola", url: "https://zola.com" }],
  recommendations: [
    {
      title: "Publier llms.txt",
      description: "Aide les crawlers IA",
      tier: "transversal",
      effort: "faible",
      priority: "haute",
      status: "pending",
      assetType: "llms_txt",
    },
  ],
  monitoring: {
    shareOfVoice: 0,
    ranAt: new Date("2026-07-06"),
    platformSov: { google_aio: 0, gemini: 0 },
    note: "baseline",
    results: [
      {
        platform: "google_aio",
        query: "meilleur outil mariage",
        mentioned: false,
        competitorsMentioned: ["Zola"],
      },
    ],
  },
};

const report = generateAuditReport(mock);
assert.ok(report.includes("Rapport d'audit visibilité agents IA"));
assert.ok(report.includes("WedApp"));
assert.ok(report.includes("llms.txt absent"));
assert.ok(report.includes("Plan d'action"));
assert.ok(report.includes("Zola"));
assert.ok(report.includes("baseline"));
console.log("audit-report self-check ok", report.split("\n").length, "lines");
