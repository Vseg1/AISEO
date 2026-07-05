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
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  runTechnicalAudit,
  scorePipeline,
  scorePlatforms,
  overallScore,
} from "@/lib/audit/engine";
import { buildRecommendations } from "@/lib/recommendations/rules";
import {
  generateLlmsTxt,
  generateRobotsTxtSuggestion,
  generateSchemaSoftware,
  generateSchemaFaq,
  generateFaqDraft,
  generateComparisonDraft,
} from "@/lib/generate/assets";
import { runVisibilityMonitor, computeShareOfVoice } from "@/lib/monitor/platforms";
import { getSolutionForUser } from "@/lib/db/queries";

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

  redirect(`/solutions/${solution.id}`);
}

export async function runAuditAction(solutionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const checks = await runTechnicalAudit(solution.url);
  const pipeline = scorePipeline(checks);
  const platforms = scorePlatforms(checks);
  const score = overallScore(pipeline);

  const db = getDb();
  const [audit] = await db
    .insert(audits)
    .values({
      solutionId,
      technicalChecks: checks,
      semanticScores: {},
      platformScores: platforms,
      pipelineScores: pipeline,
      overallScore: score,
    })
    .returning();

  await db
    .delete(recommendations)
    .where(eq(recommendations.solutionId, solutionId));

  const recs = buildRecommendations(checks);
  if (recs.length) {
    await db.insert(recommendations).values(
      recs.map((r) => ({
        solutionId,
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

  revalidatePath(`/solutions/${solutionId}`);
  revalidatePath(`/solutions/${solutionId}/audit`);
}

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

export async function generateAssetAction(
  solutionId: string,
  assetType:
    | "llms_txt"
    | "schema_faq"
    | "schema_software"
    | "faq_draft"
    | "comparison_draft"
    | "robots_txt",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié");

  const db = getDb();
  const solution = await getSolutionForUser(solutionId, session.user.id);
  if (!solution) throw new Error("Solution introuvable");

  const comps = await db
    .select()
    .from(competitors)
    .where(eq(competitors.solutionId, solutionId));

  const profile = {
    name: solution.name,
    url: solution.url,
    description: solution.description,
    category: solution.category,
    personas: solution.personas ?? [],
    useCases: solution.useCases ?? [],
    integrations: solution.integrations ?? [],
  };

  const keyPages = (solution.keyPages ?? {}) as Record<string, string>;
  let content = "";
  let title = "";

  switch (assetType) {
    case "llms_txt":
      content = generateLlmsTxt(profile, keyPages);
      title = "llms.txt";
      break;
    case "robots_txt":
      content = generateRobotsTxtSuggestion();
      title = "robots.txt";
      break;
    case "schema_software":
      content = generateSchemaSoftware(profile);
      title = "SoftwareApplication JSON-LD";
      break;
    case "schema_faq":
      content = generateSchemaFaq(profile, [
        {
          q: `Qu'est-ce que ${profile.name} ?`,
          a: profile.description ?? `${profile.name} est une solution SaaS.`,
        },
        {
          q: `Pour qui est ${profile.name} ?`,
          a: `Idéal pour ${profile.personas[0] ?? "équipes professionnelles"}.`,
        },
      ]);
      title = "FAQPage JSON-LD";
      break;
    case "faq_draft":
      content = generateFaqDraft(profile);
      title = "Brouillon FAQ";
      break;
    case "comparison_draft":
      content = generateComparisonDraft(profile, comps);
      title = "Brouillon comparatif";
      break;
  }

  await db
    .insert(generatedAssets)
    .values({ solutionId, type: assetType, title, content });

  revalidatePath(`/solutions/${solutionId}/assets`);
}

export async function runMonitorAction(solutionId: string) {
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
  );

  const shareOfVoice = computeShareOfVoice(results, (r) => r.mentioned);

  const [run] = await db
    .insert(visibilityRuns)
    .values({ solutionId, shareOfVoice })
    .returning();

  await db.insert(visibilityResults).values(
    results.map((r) => ({
      runId: run.id,
      platform: r.platform,
      query: r.query,
      mentioned: r.mentioned,
      mentionRank: r.mentionRank,
      sources: r.sources,
      competitorsMentioned: r.competitorsMentioned,
      rawResponse: r.rawResponse,
    })),
  );

  revalidatePath(`/solutions/${solutionId}/monitoring`);
}
