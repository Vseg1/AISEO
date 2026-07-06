import assert from "node:assert/strict";
import {
  computeShareOfVoice,
  computePlatformSov,
  getMonitorQueryLimit,
  extractMention,
  type MonitorResult,
} from "../src/lib/monitor/platforms";

const base: MonitorResult = {
  platform: "gemini",
  query: "test",
  mentioned: true,
  configured: true,
  mentionRank: null,
  sources: [],
  competitorsMentioned: [],
  rawResponse: "ok",
};

// SOV exclut les résultats simulés (configured=false)
assert.equal(
  computeShareOfVoice([base, { ...base, mentioned: false }]),
  50,
);
assert.equal(
  computeShareOfVoice([
    base,
    { ...base, mentioned: false, configured: false },
  ]),
  100,
);
assert.equal(computeShareOfVoice([]), 0);

// SOV par plateforme
const sov = computePlatformSov([
  base,
  { ...base, mentioned: false },
  { ...base, platform: "chatgpt", mentioned: false },
  { ...base, platform: "google_aio", configured: false },
]);
assert.equal(sov.gemini, 50);
assert.equal(sov.chatgpt, 0);
assert.equal(sov.google_aio, undefined);

// Mention : mot entier, pas de faux positif substring
assert.equal(extractMention("Essayez Notion pour vos docs", "Notion", "https://notion.so"), true);
assert.equal(extractMention("Une notion importante", "Notion", "https://x.com"), true); // même mot — limite assumée
assert.equal(extractMention("Utilisez Slacker", "Slack", "https://slack.com"), false);
assert.equal(extractMention("Voir www.slack.com/pricing", "Autre", "https://slack.com"), true);

// Limite requêtes free vs paid
process.env.PERPLEXITY_API_KEY = "";
process.env.SERPAPI_API_KEY = "";
delete process.env.MONITOR_OPENAI_PAID;
assert.equal(getMonitorQueryLimit(), 3);

process.env.PERPLEXITY_API_KEY = "x";
assert.equal(getMonitorQueryLimit(), 10);

console.log("monitor self-check ok");
