"use server";

import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import {
  solutions,
  targetQueries,
  competitors,
  audits,
  recommendations,
  generatedAssets,
  visibilityRuns,
  visibilityResults,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  runTechnicalAudit,
  scorePipeline,
  scorePlatforms,
  overallScore,
} from "@/lib/audit/engine";
import { runSemanticAudit } from "@/lib/audit/semantic";
import { buildRecommendations } from "@/lib/recommendations/rules";
import {
  generateLlmsTxt,
  generateRobotsTxtSuggestion,
  generateSchemaSoftware,
  generateSchemaFaq,
  generateFaqDraft,
  generateComparisonDraft,
  buildFaqQuestions,
} from "@/lib/generate/assets";
import {
  runVisibilityMonitor,
  computeShareOfVoice,
  computePlatformSov,
} from "@/lib/monitor/platforms";
import { getSolutionForUser, getLatestAudit, getRecommendations, getVisibilityHistory } from "@/lib/db/queries";
import { generateAuditReport } from "@/lib/generate/audit-report";
import type { TechnicalChecks } from "@/lib/audit/engine";

const solutionSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["website", "webapp", "saas"]),
  language: z.string().default("fr"),
  markets: z.string().optional(),
  description: z.string().min(1),
  category: z.string().optional(),
  personas: z.string().optional(),
  useCases: z.string().optional(),
  integrations: z.string().optional(),
  competitorNames: z.string().optional(),
  competitorUrls: z.string().optional(),
  queries: z.string().min(1, "Au moins une requête cible requise"),
  keyPagesPricing: z.string().optional(),
  keyPagesDocs: z.string().optional(),
  keyPagesBlog: z.string().optional(),
});

function splitLines(s?: string) {
  return (s ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Audit technique + sémantique + recommandations pour une solution. */
async function performAudit(solution: {
  id: string;
  url: string;
  keyPages: Record<string, string> | null;
}) {
  const db = getDb();
  const queries = await db
    .select()
    .from(targetQueries)
    .where(eq(targetQueries.solutionId, solution.id));

  const keyPageUrls = Object.values(solution.keyPages ?? {});
  const checks = await runTechnicalAudit(solution.url, keyPageUrls);
  const semanticScores = await runSemanticAudit(
    solution.url,
    queries.map((q) => q.query),
  );
  const pipeline = scorePipeline(checks);
  const platforms = scorePlatforms(checks);
  const score = overallScore(pipeline);

  const [audit] = await db
    .insert(audits)
    .values({
      solutionId: solution.id,
      technicalChecks: checks,
      semanticScores,
      platformScores: platforms,
      pipelineScores: pipeline,
      overallScore: score,
    })
    .returning();

  // On ne remplace que les recommandations non traitées : les done/skipped
  // sont conservées pour le suivi du pilote.
  await db
    .delete(recommendations)
    .where(
      and(
        eq(recommendations.solutionId, solution.id),
        eq(recommendations.status, "pending"),
      ),
    );

  const existing = await db
    .select({ title: recommendations.title })
    .from(recommendations)
    .where(eq(recommendations.solutionId, solution.id));
  const existingTitles = new Set(existing.map((r) => r.title));

  const recs = buildRecommendations(checks).filter(
    (r) => !existingTitles.has(r.title),
  );
  if (recs.length) {
    await db.insert(recommendations).values(
      recs.map((r) => ({
        solutionId: solution.id,
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
}

export async function createSolution(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const parsed = solutionSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    type: formData.get("type"),
    language: formData.get("language") || "fr",
    markets: formData.get("markets")?.toString(),
    description: formData.get("description")?.toString(),
    category: formData.get("category")?.toString(),
    personas: formData.get("personas")?.toString(),
    useCases: formData.get("useCases")?.toString(),
    integrations: formData.get("integrations")?.toString(),
    competitorNames: formData.get("competitorNames")?.toString(),
    competitorUrls: formData.get("competitorUrls")?.toString(),
    queries: formData.get("queries")?.toString(),
    keyPagesPricing: formData.get("keyPagesPricing")?.toString(),
    keyPagesDocs: formData.get("keyPagesDocs")?.toString(),
    keyPagesBlog: formData.get("keyPagesBlog")?.toString(),
  });

  const db = getDb();
  const names = splitLines(parsed.competitorNames);
  const urls = splitLines(parsed.competitorUrls);
  const keyPages: Record<string, string> = {};
  if (parsed.keyPagesPricing) keyPages.pricing = parsed.keyPagesPricing;
  if (parsed.keyPagesDocs) keyPages.docs = parsed.keyPagesDocs;
  if (parsed.keyPagesBlog) keyPages.blog = parsed.keyPagesBlog;

  const [solution] = await db
    .insert(solutions)
    .values({
      userId: session.user.id,
      name: parsed.name,
      url: parsed.url,
      type: parsed.type,
      language: parsed.language,
      markets: splitLines(parsed.markets),
      description: parsed.description,
      category: parsed.category,
      personas: splitLines(parsed.personas),
      useCases: splitLines(parsed.useCases),
      integrations: splitLines(parsed.integrations),
      keyPages,
    })
    .returning();

  const queryList = splitLines(parsed.queries);
  if (queryList.length) {
    await db.insert(targetQueries).values(
      queryList.map((query) => ({ solutionId: solution.id, query })),
    );
  }

  if (names.length) {
    await db.insert(competitors).values(
      names.map((name, i) => ({
        solutionId: solution.id,
        name,
        url: urls[i] || null,
      })),
    );
  }

  // Auto-audit : le CTA onboarding promet « Créer et analyser »
  try {
    await performAudit(solution);
  } catch {
    // site injoignable — l'utilisateur pourra relancer l'audit manuellement
  }

  redirect(`/solutions/${solution.id}`);
}

export async function runAuditAction(solutionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  await performAudit(solution);

  revalidatePath(`/solutions/${solutionId}`);
  revalidatePath(`/solutions/${solutionId}/audit`);
  revalidatePath(`/solutions/${solutionId}/recommendations`);
}

// ---------------------------------------------------------------------------
// Édition du profil solution (settings)
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  description: z.string().min(1),
  language: z.string().min(1),
  markets: z.string().optional(),
  monitoringEnabled: z.boolean(),
});

export async function updateSolution(solutionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const parsed = updateSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    description: formData.get("description")?.toString(),
    language: formData.get("language") || "fr",
    markets: formData.get("markets")?.toString(),
    monitoringEnabled: formData.get("monitoringEnabled") === "on",
  });

  const db = getDb();
  await db
    .update(solutions)
    .set({
      name: parsed.name,
      url: parsed.url,
      description: parsed.description,
      language: parsed.language,
      markets: splitLines(parsed.markets),
      monitoringEnabled: parsed.monitoringEnabled,
      updatedAt: new Date(),
    })
    .where(eq(solutions.id, solutionId));

  revalidatePath(`/solutions/${solutionId}`);
  revalidatePath(`/solutions/${solutionId}/settings`);
}

export async function addTargetQuery(solutionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const query = formData.get("query")?.toString().trim();
  if (!query) return;

  const db = getDb();
  await db.insert(targetQueries).values({ solutionId, query });
  await db
    .update(solutions)
    .set({ updatedAt: new Date() })
    .where(eq(solutions.id, solutionId));

  revalidatePath(`/solutions/${solutionId}/settings`);
  revalidatePath(`/solutions/${solutionId}`);
}

export async function deleteTargetQuery(
  solutionId: string,
  queryId: string,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const db = getDb();
  await db
    .delete(targetQueries)
    .where(
      and(
        eq(targetQueries.id, queryId),
        eq(targetQueries.solutionId, solutionId),
      ),
    );

  revalidatePath(`/solutions/${solutionId}/settings`);
  revalidatePath(`/solutions/${solutionId}`);
}

export async function addCompetitor(solutionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const name = formData.get("name")?.toString().trim();
  if (!name) return;
  const url = formData.get("url")?.toString().trim() || null;

  const db = getDb();
  await db.insert(competitors).values({ solutionId, name, url });

  revalidatePath(`/solutions/${solutionId}/settings`);
  revalidatePath(`/solutions/${solutionId}`);
}

export async function deleteCompetitor(
  solutionId: string,
  competitorId: string,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const db = getDb();
  await db
    .delete(competitors)
    .where(
      and(
        eq(competitors.id, competitorId),
        eq(competitors.solutionId, solutionId),
      ),
    );

  revalidatePath(`/solutions/${solutionId}/settings`);
  revalidatePath(`/solutions/${solutionId}`);
}

// ---------------------------------------------------------------------------
// Recommandations & assets
// ---------------------------------------------------------------------------

export async function updateRecommendationStatus(
  recommendationId: string,
  solutionId: string,
  status: "pending" | "done" | "skipped",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");
  await getSolutionForUser(solutionId, session.user.id);

  const db = getDb();
  await db
    .update(recommendations)
    .set({ status })
    .where(eq(recommendations.id, recommendationId));

  revalidatePath(`/solutions/${solutionId}/recommendations`);
}

export type AssetType =
  | "llms_txt"
  | "schema_faq"
  | "schema_software"
  | "faq_draft"
  | "comparison_draft"
  | "robots_txt";

export async function generateAssetAction(
  solutionId: string,
  assetType: AssetType,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const db = getDb();
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const [comps, queries] = await Promise.all([
    db
      .select()
      .from(competitors)
      .where(eq(competitors.solutionId, solutionId)),
    db
      .select()
      .from(targetQueries)
      .where(eq(targetQueries.solutionId, solutionId)),
  ]);
  const queryTexts = queries.map((q) => q.query);

  const profile = {
    name: solution.name,
    url: solution.url,
    description: solution.description,
    category: solution.category,
    language: solution.language,
    markets: solution.markets ?? [],
    personas: solution.personas ?? [],
    useCases: solution.useCases ?? [],
    integrations: solution.integrations ?? [],
  };

  const keyPages = (solution.keyPages ?? {}) as Record<string, string>;
  let content = "";
  let title = "";

  switch (assetType) {
    case "llms_txt":
      content = generateLlmsTxt(profile, keyPages, comps, queryTexts);
      title = "llms.txt";
      break;
    case "robots_txt":
      content = generateRobotsTxtSuggestion();
      title = "robots.txt";
      break;
    case "schema_software":
      content = generateSchemaSoftware(profile, keyPages);
      title = "SoftwareApplication JSON-LD";
      break;
    case "schema_faq":
      content = generateSchemaFaq(profile, buildFaqQuestions(profile, queryTexts));
      title = "FAQPage JSON-LD";
      break;
    case "faq_draft":
      content = generateFaqDraft(profile, queryTexts);
      title = "Brouillon FAQ";
      break;
    case "comparison_draft":
      content = generateComparisonDraft(profile, comps);
      title = "Brouillon comparatif";
      break;
  }

  // Upsert par type : régénérer remplace la version précédente
  const [existing] = await db
    .select({ id: generatedAssets.id })
    .from(generatedAssets)
    .where(
      and(
        eq(generatedAssets.solutionId, solutionId),
        eq(generatedAssets.type, assetType),
      ),
    );

  if (existing) {
    await db
      .update(generatedAssets)
      .set({ title, content, updatedAt: new Date() })
      .where(eq(generatedAssets.id, existing.id));
  } else {
    await db
      .insert(generatedAssets)
      .values({ solutionId, type: assetType, title, content });
  }

  revalidatePath(`/solutions/${solutionId}/assets`);
}

/** Génère le rapport d'audit global (markdown) et le sauvegarde dans les assets. */
export async function generateAuditReportAction(solutionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const db = getDb();
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const audit = await getLatestAudit(solutionId, session.user.id);
  if (!audit) throw new Error("Lancez un audit avant de générer le rapport.");

  const [comps, queries, recs, history] = await Promise.all([
    db.select().from(competitors).where(eq(competitors.solutionId, solutionId)),
    db.select().from(targetQueries).where(eq(targetQueries.solutionId, solutionId)),
    getRecommendations(solutionId, session.user.id),
    getVisibilityHistory(solutionId, session.user.id),
  ]);

  const checks = audit.technicalChecks as TechnicalChecks;
  const monitoring = history.selectedRun
    ? {
        shareOfVoice: history.selectedRun.shareOfVoice,
        ranAt: history.selectedRun.ranAt,
        platformSov: (history.selectedRun.platformSov ?? {}) as Record<string, number>,
        note: history.selectedRun.note,
        results: history.selectedResults
          .filter((r) => r.configured !== false)
          .map((r) => ({
            platform: r.platform,
            query: r.query,
            mentioned: r.mentioned ?? false,
            competitorsMentioned: (r.competitorsMentioned ?? []) as string[],
          })),
      }
    : undefined;

  const content = generateAuditReport({
    solution: {
      name: solution.name,
      url: solution.url,
      type: solution.type,
      language: solution.language,
      description: solution.description,
      category: solution.category,
      markets: solution.markets ?? [],
      personas: solution.personas ?? [],
      useCases: solution.useCases ?? [],
      integrations: solution.integrations ?? [],
    },
    audit: {
      overallScore: audit.overallScore,
      ranAt: audit.ranAt,
      pipelineScores: (audit.pipelineScores ?? {}) as Record<string, number>,
      platformScores: (audit.platformScores ?? {}) as Record<string, number>,
      semanticScores: (audit.semanticScores ?? {}) as Record<string, number>,
      technicalChecks: checks,
    },
    queries: queries.map((q) => q.query),
    competitors: comps,
    recommendations: recs.map((r) => ({
      title: r.title,
      description: r.description,
      tier: r.tier,
      effort: r.effort,
      priority: r.priority,
      status: r.status,
      assetType: r.assetType,
    })),
    monitoring,
  });

  const title = `Rapport d'audit — ${solution.name}`;
  const [existing] = await db
    .select({ id: generatedAssets.id })
    .from(generatedAssets)
    .where(
      and(
        eq(generatedAssets.solutionId, solutionId),
        eq(generatedAssets.type, "audit_report"),
      ),
    );

  if (existing) {
    await db
      .update(generatedAssets)
      .set({ title, content, updatedAt: new Date() })
      .where(eq(generatedAssets.id, existing.id));
  } else {
    await db.insert(generatedAssets).values({
      solutionId,
      type: "audit_report",
      title,
      content,
    });
  }

  revalidatePath(`/solutions/${solutionId}/assets`);
  revalidatePath(`/solutions/${solutionId}/audit`);
}

/** Génère l'asset lié à une reco depuis la page recommandations. */
export async function generateAssetFromRecommendation(
  solutionId: string,
  assetType: AssetType,
) {
  await generateAssetAction(solutionId, assetType);
  redirect(`/solutions/${solutionId}/assets`);
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export async function runMonitorAction(solutionId: string, formData?: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const db = getDb();
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const queries = await db
    .select()
    .from(targetQueries)
    .where(eq(targetQueries.solutionId, solutionId));
  const comps = await db
    .select()
    .from(competitors)
    .where(eq(competitors.solutionId, solutionId));

  const queryTexts = queries.map((q) => q.query);
  if (!queryTexts.length) {
    throw new Error("Ajoutez des requêtes cibles dans le profil solution.");
  }

  const results = await runVisibilityMonitor(
    queryTexts,
    solution.name,
    solution.url,
    comps.map((c) => c.name),
    solution.language ?? "fr",
  );

  const shareOfVoice = computeShareOfVoice(results);
  const platformSov = computePlatformSov(results);
  const note = formData?.get("note")?.toString().trim() || null;

  const [run] = await db
    .insert(visibilityRuns)
    .values({ solutionId, shareOfVoice, platformSov, note })
    .returning();

  await db.insert(visibilityResults).values(
    results.map((r) => ({
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

  revalidatePath(`/solutions/${solutionId}/monitoring`);
  revalidatePath(`/solutions/${solutionId}`);
}
