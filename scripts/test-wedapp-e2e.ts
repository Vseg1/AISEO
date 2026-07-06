/**
 * E2E feature test for WedApp solution — run with:
 *   set -a && source .env.local && set +a && npx tsx scripts/test-wedapp-e2e.ts
 */
import assert from "node:assert/strict";
import { getDb } from "../src/lib/db";
import {
  solutions,
  targetQueries,
  competitors,
  audits,
  recommendations,
  generatedAssets,
  visibilityRuns,
  visibilityResults,
} from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { runTechnicalAudit } from "../src/lib/audit/engine";
import { runSemanticAudit } from "../src/lib/audit/semantic";
import { buildRecommendations } from "../src/lib/recommendations/rules";
import {
  generateLlmsTxt,
  generateRobotsTxtSuggestion,
  generateSchemaSoftware,
  generateSchemaFaq,
  generateFaqDraft,
  generateComparisonDraft,
  buildFaqQuestions,
} from "../src/lib/generate/assets";
import {
  runVisibilityMonitor,
  computeShareOfVoice,
  computePlatformSov,
  getPlatformStatuses,
  getMonitorQueryLimit,
} from "../src/lib/monitor/platforms";

const report: { step: string; status: "ok" | "warn" | "fail"; detail: string }[] =
  [];

function log(step: string, status: "ok" | "warn" | "fail", detail: string) {
  report.push({ step, status, detail });
  const icon = status === "ok" ? "✓" : status === "warn" ? "⚠" : "✗";
  console.log(`${icon} ${step}: ${detail}`);
}

async function main() {
  const db = getDb();
  const all = await db.select().from(solutions);
  const wed =
    all.find((s) => /wed/i.test(s.name) || /wed/i.test(s.url)) ?? all[0];

  if (!wed) {
    console.error("Aucune solution en base. Créez WedApp via onboarding d'abord.");
    process.exit(1);
  }

  log("DB", "ok", `Solution « ${wed.name} » (${wed.url}) id=${wed.id.slice(0, 8)}…`);

  const [queries, comps, latestAudit, recs, assets, runs] = await Promise.all([
    db.select().from(targetQueries).where(eq(targetQueries.solutionId, wed.id)),
    db.select().from(competitors).where(eq(competitors.solutionId, wed.id)),
    db
      .select()
      .from(audits)
      .where(eq(audits.solutionId, wed.id))
      .orderBy(desc(audits.ranAt))
      .limit(1),
    db.select().from(recommendations).where(eq(recommendations.solutionId, wed.id)),
    db.select().from(generatedAssets).where(eq(generatedAssets.solutionId, wed.id)),
    db
      .select()
      .from(visibilityRuns)
      .where(eq(visibilityRuns.solutionId, wed.id))
      .orderBy(desc(visibilityRuns.ranAt))
      .limit(1),
  ]);

  // --- Profil ---
  if (queries.length > 0) {
    log("Profil requêtes", "ok", `${queries.length} requête(s) : ${queries.map((q) => q.query).join(" | ")}`);
  } else {
    log("Profil requêtes", "fail", "Aucune requête cible");
  }
  log("Profil concurrents", comps.length > 0 ? "ok" : "warn", `${comps.length} concurrent(s)`);
  log("Settings monitoringEnabled", "ok", String(wed.monitoringEnabled));

  // --- Audit technique (live crawl) ---
  const keyPages = Object.values((wed.keyPages ?? {}) as Record<string, string>);
  let checks;
  try {
    checks = await runTechnicalAudit(wed.url, keyPages);
    assert.equal(checks.statusCode, 200);
    log(
      "Audit technique (live)",
      "ok",
      `score pipeline retrieval=${checks.responseTimeMs}ms, pages=${checks.crawledPages}, llms=${checks.llmsTxt.exists}, robots=${checks.robotsTxt.exists}`,
    );
  } catch (e) {
    log("Audit technique (live)", "fail", e instanceof Error ? e.message : String(e));
    checks = null;
  }

  if (checks) {
    const recsBuilt = buildRecommendations(checks);
    assert.ok(recsBuilt.length >= 3);
    log("Moteur recommandations", "ok", `${recsBuilt.length} règles déclenchées`);
  }

  // --- Audit sémantique ---
  if (process.env.GEMINI_API_KEY && queries.length) {
    const semantic = await runSemanticAudit(
      wed.url,
      queries.map((q) => q.query),
    );
    if (Object.keys(semantic).length > 0) {
      log(
        "Audit sémantique Gemini",
        "ok",
        Object.entries(semantic)
          .map(([q, s]) => `${s}/100 « ${q.slice(0, 40)}… »`)
          .join("; "),
      );
    } else {
      log("Audit sémantique Gemini", "warn", "Vide (quota API ou erreur)");
    }
  } else {
    log("Audit sémantique Gemini", "warn", "GEMINI_API_KEY absente ou pas de requêtes");
  }

  // --- Audit en DB ---
  if (latestAudit[0]) {
    log(
      "Audit en DB",
      "ok",
      `Score ${latestAudit[0].overallScore}/100, sémantique: ${Object.keys((latestAudit[0].semanticScores as object) ?? {}).length} requête(s)`,
    );
  } else {
    log("Audit en DB", "warn", "Aucun audit persisté — relancer depuis l'UI");
  }

  // --- Recommandations en DB ---
  const pending = recs.filter((r) => r.status === "pending").length;
  log(
    "Recommandations DB",
    recs.length > 0 ? "ok" : "warn",
    `${recs.length} total, ${pending} en attente`,
  );

  // --- Génération assets (templates) ---
  const profile = {
    name: wed.name,
    url: wed.url,
    description: wed.description,
    category: wed.category,
    language: wed.language,
    markets: wed.markets ?? [],
    personas: wed.personas ?? [],
    useCases: wed.useCases ?? [],
    integrations: wed.integrations ?? [],
  };
  const queryTexts = queries.map((q) => q.query);
  const llms = generateLlmsTxt(profile, wed.keyPages as Record<string, string>, comps, queryTexts);
  assert.ok(llms.includes(wed.name));
  log("Asset llms.txt", "ok", `${llms.split("\n").length} lignes`);

  const schema = generateSchemaSoftware(profile, wed.keyPages as Record<string, string>);
  assert.ok(schema.includes("SoftwareApplication"));
  log("Asset schema_software", "ok", "JSON-LD valide");

  const faq = generateFaqDraft(profile, queryTexts);
  assert.ok(faq.includes(wed.name));
  log("Asset faq_draft", "ok", `${faq.length} caractères`);

  const comp = generateComparisonDraft(profile, comps);
  assert.ok(comp.includes(wed.name));
  log("Asset comparison_draft", comps.length > 0 ? "ok" : "warn", `${comps.length} colonnes concurrents`);

  const robots = generateRobotsTxtSuggestion();
  assert.ok(robots.includes("GPTBot"));
  log("Asset robots.txt", "ok", "Suggestion générée");

  const faqSchema = generateSchemaFaq(profile, buildFaqQuestions(profile, queryTexts));
  assert.ok(faqSchema.includes("FAQPage"));
  log("Asset schema_faq", "ok", "JSON-LD FAQPage");

  log(
    "Assets en DB",
    assets.length > 0 ? "ok" : "warn",
    assets.length ? assets.map((a) => a.type).join(", ") : "Aucun — générer depuis l'UI",
  );

  // --- Monitoring ---
  const statuses = getPlatformStatuses();
  const active = statuses.filter((s) => s.active);
  log(
    "Plateformes monitoring",
    active.length > 0 ? "ok" : "fail",
    active.map((s) => s.platform).join(", ") || "aucune clé",
  );

  const limit = getMonitorQueryLimit();
  log("Limite requêtes/run", "ok", `${limit} (${limit === 3 ? "gratuit" : "étendu"})`);

  if (queries.length > 0 && active.length > 0) {
    const results = await runVisibilityMonitor(
      queryTexts,
      wed.name,
      wed.url,
      comps.map((c) => c.name),
      wed.language ?? "fr",
    );
    const configured = results.filter((r) => r.configured);
    const sov = computeShareOfVoice(results);
    const platformSov = computePlatformSov(results);
    for (const r of configured) {
      const err = /quota|429|error/i.test(r.rawResponse);
      log(
        `Monitor ${r.platform}`,
        err ? "warn" : "ok",
        err
          ? r.rawResponse.slice(0, 100)
          : `mention=${r.mentioned}, concurrents=[${r.competitorsMentioned.join(",")}]`,
      );
    }
    log("SOV calculé", configured.length > 0 ? "ok" : "fail", `${sov}% global, par plateforme: ${JSON.stringify(platformSov)}`);
  }

  if (runs[0]) {
    log(
      "Dernier run DB",
      "ok",
      `SOV ${runs[0].shareOfVoice}% le ${runs[0].ranAt.toISOString().slice(0, 10)}`,
    );
    const results = await db
      .select()
      .from(visibilityResults)
      .where(eq(visibilityResults.runId, runs[0].id));
    log("Résultats dernier run", "ok", `${results.length} lignes (${results.filter((r) => r.configured !== false).length} configurées)`);
  } else {
    log("Dernier run DB", "warn", "Aucun run — lancer depuis Monitoring");
  }

  // --- Résumé ---
  const fails = report.filter((r) => r.status === "fail").length;
  const warns = report.filter((r) => r.status === "warn").length;
  console.log("\n--- RÉSUMÉ ---");
  console.log(`OK: ${report.filter((r) => r.status === "ok").length} | WARN: ${warns} | FAIL: ${fails}`);
  if (fails > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
