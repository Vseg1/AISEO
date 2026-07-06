/**
 * Full integration test for wedapp — exercises DB writes like the UI actions.
 *   set -a && source .env.local && set +a && npx tsx scripts/test-wedapp-full.ts
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
import { eq, and, desc } from "drizzle-orm";
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
} from "../src/lib/monitor/platforms";

const WED_ID = "32f34ab8-7719-4ba4-a766-942d0bf25049";
const results: string[] = [];

function pass(msg: string) {
  results.push(`✓ ${msg}`);
  console.log(`✓ ${msg}`);
}
function fail(msg: string) {
  results.push(`✗ ${msg}`);
  console.error(`✗ ${msg}`);
}

async function main() {
  const db = getDb();
  const [wed] = await db.select().from(solutions).where(eq(solutions.id, WED_ID));
  assert.ok(wed, "Solution wedapp introuvable");
  pass(`Solution wedapp — ${wed.url}`);

  // --- 1. Settings: update profile ---
  await db
    .update(solutions)
    .set({ description: wed.description, updatedAt: new Date() })
    .where(eq(solutions.id, WED_ID));
  pass("Settings updateSolution (profil)");

  // --- 2. Settings: add/delete query (rollback) ---
  const testQuery = `__test_query_${Date.now()}`;
  const [insertedQ] = await db
    .insert(targetQueries)
    .values({ solutionId: WED_ID, query: testQuery })
    .returning();
  assert.ok(insertedQ);
  pass("Settings addTargetQuery");

  await db.delete(targetQueries).where(eq(targetQueries.id, insertedQ.id));
  pass("Settings deleteTargetQuery");

  // --- 3. Full audit pipeline (like runAuditAction) ---
  const queries = await db
    .select()
    .from(targetQueries)
    .where(eq(targetQueries.solutionId, WED_ID));
  const keyPages = Object.values((wed.keyPages ?? {}) as Record<string, string>);
  const checks = await runTechnicalAudit(wed.url, keyPages);
  assert.equal(checks.statusCode, 200);
  const semanticScores = await runSemanticAudit(
    wed.url,
    queries.map((q) => q.query),
  );
  const pipeline = {
    retrieval: Math.min(100, (checks.statusCode === 200 ? 25 : 0) + (checks.sitemap.exists ? 15 : 0)),
    scoring: 0,
    synthesis: 0,
  };
  const { scorePipeline, scorePlatforms, overallScore } = await import(
    "../src/lib/audit/engine"
  );
  const pipe = scorePipeline(checks);
  const platforms = scorePlatforms(checks);
  const score = overallScore(pipe);

  const [audit] = await db
    .insert(audits)
    .values({
      solutionId: WED_ID,
      technicalChecks: checks,
      semanticScores,
      platformScores: platforms,
      pipelineScores: pipe,
      overallScore: score,
    })
    .returning();

  await db
    .delete(recommendations)
    .where(and(eq(recommendations.solutionId, WED_ID), eq(recommendations.status, "pending")));

  const recs = buildRecommendations(checks);
  if (recs.length) {
    await db.insert(recommendations).values(
      recs.map((r) => ({
        solutionId: WED_ID,
        auditId: audit.id,
        title: r.title,
        description: r.description,
        tier: r.tier,
        effort: r.effort,
        priority: r.priority,
        assetType: r.assetType ?? null,
      })),
    );
  }
  pass(`Audit complet — score ${score}/100, ${recs.length} recos, ${checks.crawledPages} pages`);

  // --- 4. Generate all 6 assets (upsert) ---
  const comps = await db
    .select()
    .from(competitors)
    .where(eq(competitors.solutionId, WED_ID));
  const queryTexts = queries.map((q) => q.query);
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
  const keyPagesMap = (wed.keyPages ?? {}) as Record<string, string>;

  const assetDefs: { type: typeof generatedAssets.$inferInsert.type; title: string; content: string }[] = [
    { type: "llms_txt", title: "llms.txt", content: generateLlmsTxt(profile, keyPagesMap, comps, queryTexts) },
    { type: "robots_txt", title: "robots.txt", content: generateRobotsTxtSuggestion() },
    { type: "schema_software", title: "SoftwareApplication JSON-LD", content: generateSchemaSoftware(profile, keyPagesMap) },
    { type: "schema_faq", title: "FAQPage JSON-LD", content: generateSchemaFaq(profile, buildFaqQuestions(profile, queryTexts)) },
    { type: "faq_draft", title: "Brouillon FAQ", content: generateFaqDraft(profile, queryTexts) },
    { type: "comparison_draft", title: "Brouillon comparatif", content: generateComparisonDraft(profile, comps) },
  ];

  for (const { type, title, content } of assetDefs) {
    const [existing] = await db
      .select({ id: generatedAssets.id })
      .from(generatedAssets)
      .where(and(eq(generatedAssets.solutionId, WED_ID), eq(generatedAssets.type, type)));
    if (existing) {
      await db
        .update(generatedAssets)
        .set({ title, content, updatedAt: new Date() })
        .where(eq(generatedAssets.id, existing.id));
    } else {
      await db.insert(generatedAssets).values({ solutionId: WED_ID, type, title, content });
    }
  }
  pass("6 assets générés/mis à jour (upsert)");

  // --- 5. Recommendation status ---
  const [firstReco] = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.solutionId, WED_ID))
    .limit(1);
  if (firstReco) {
    await db
      .update(recommendations)
      .set({ status: "done" })
      .where(eq(recommendations.id, firstReco.id));
    await db
      .update(recommendations)
      .set({ status: "pending" })
      .where(eq(recommendations.id, firstReco.id));
    pass("updateRecommendationStatus (done → pending)");
  }

  // --- 6. Monitoring run + persist ---
  const monitorResults = await runVisibilityMonitor(
    queryTexts,
    wed.name,
    wed.url,
    comps.map((c) => c.name),
    wed.language ?? "fr",
  );
  const shareOfVoice = computeShareOfVoice(monitorResults);
  const platformSov = computePlatformSov(monitorResults);
  const [run] = await db
    .insert(visibilityRuns)
    .values({
      solutionId: WED_ID,
      shareOfVoice,
      platformSov,
      note: "test-intégration",
    })
    .returning();

  await db.insert(visibilityResults).values(
    monitorResults.map((r) => ({
      runId: run.id,
      platform: r.platform,
      query: r.query,
      mentioned: r.mentioned,
      configured: r.configured,
      mentionRank: r.mentionRank,
      sources: r.sources,
      competitorsMentioned: r.competitorsMentioned,
      rawResponse: r.rawResponse,
    })),
  );
  const configured = monitorResults.filter((r) => r.configured);
  pass(
    `Monitoring run — SOV ${shareOfVoice}%, ${configured.length} plateformes, note=test-intégration`,
  );

  // --- 7. Cron endpoint ---
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const res = await fetch("http://localhost:3000/api/cron/monitor", {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const body = (await res.json()) as { ok?: boolean; processed?: number };
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    pass(`Cron /api/cron/monitor — processed=${body.processed}`);
  } else {
    console.log("⚠ CRON_SECRET absent — cron non testé");
  }

  // --- Assertions finales ---
  const [finalAudit] = await db
    .select()
    .from(audits)
    .where(eq(audits.solutionId, WED_ID))
    .orderBy(desc(audits.ranAt))
    .limit(1);
  const assetCount = await db
    .select()
    .from(generatedAssets)
    .where(eq(generatedAssets.solutionId, WED_ID));
  const [finalRun] = await db
    .select()
    .from(visibilityRuns)
    .where(eq(visibilityRuns.solutionId, WED_ID))
    .orderBy(desc(visibilityRuns.ranAt))
    .limit(1);

  assert.ok(finalAudit && finalAudit.overallScore !== null);
  assert.ok(assetCount.length >= 6);
  assert.ok(finalRun?.note === "test-intégration" || finalRun);

  console.log("\n=== INTÉGRATION WEDAPP OK ===");
  console.log(`Audit: ${finalAudit?.overallScore}/100`);
  console.log(`Assets: ${assetCount.length}`);
  console.log(`Dernier run: SOV ${finalRun?.shareOfVoice}%`);
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
