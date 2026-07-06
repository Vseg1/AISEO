import { eq, and, desc, count, inArray } from "drizzle-orm";
import { getDb } from "./index";
import {
  solutions,
  targetQueries,
  competitors,
  audits,
  recommendations,
  generatedAssets,
  visibilityRuns,
  visibilityResults,
} from "../../../drizzle/schema";

export async function getSolutionsForUser(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(solutions)
    .where(eq(solutions.userId, userId))
    .orderBy(desc(solutions.updatedAt));
}

export async function getSolutionForUser(solutionId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(solutions)
    .where(and(eq(solutions.id, solutionId), eq(solutions.userId, userId)));
  return row ?? null;
}

export async function getSolutionWithRelations(
  solutionId: string,
  userId: string,
) {
  const solution = await getSolutionForUser(solutionId, userId);
  if (!solution) return null;
  const db = getDb();
  const [queries, comps, latestAudit] = await Promise.all([
    db
      .select()
      .from(targetQueries)
      .where(eq(targetQueries.solutionId, solutionId)),
    db
      .select()
      .from(competitors)
      .where(eq(competitors.solutionId, solutionId)),
    db
      .select()
      .from(audits)
      .where(eq(audits.solutionId, solutionId))
      .orderBy(desc(audits.ranAt))
      .limit(1),
  ]);
  return {
    solution,
    queries,
    competitors: comps,
    latestAudit: latestAudit[0] ?? null,
  };
}

export async function getLatestAudit(solutionId: string, userId: string) {
  const solution = await getSolutionForUser(solutionId, userId);
  if (!solution) return null;
  const db = getDb();
  const [audit] = await db
    .select()
    .from(audits)
    .where(eq(audits.solutionId, solutionId))
    .orderBy(desc(audits.ranAt))
    .limit(1);
  return audit ?? null;
}

export async function getRecommendations(solutionId: string, userId: string) {
  const solution = await getSolutionForUser(solutionId, userId);
  if (!solution) return [];
  const db = getDb();
  return db
    .select()
    .from(recommendations)
    .where(eq(recommendations.solutionId, solutionId))
    .orderBy(desc(recommendations.createdAt));
}

export async function getAssets(solutionId: string, userId: string) {
  const solution = await getSolutionForUser(solutionId, userId);
  if (!solution) return [];
  const db = getDb();
  return db
    .select()
    .from(generatedAssets)
    .where(eq(generatedAssets.solutionId, solutionId))
    .orderBy(desc(generatedAssets.updatedAt));
}

export async function getVisibilityHistory(
  solutionId: string,
  userId: string,
  runId?: string,
) {
  const solution = await getSolutionForUser(solutionId, userId);
  if (!solution) return { runs: [], selectedRun: null, selectedResults: [] };
  const db = getDb();
  const runs = await db
    .select()
    .from(visibilityRuns)
    .where(eq(visibilityRuns.solutionId, solutionId))
    .orderBy(desc(visibilityRuns.ranAt))
    .limit(20);
  if (runs.length === 0) {
    return { runs: [], selectedRun: null, selectedResults: [] };
  }
  const selectedRun = runs.find((r) => r.id === runId) ?? runs[0];
  const results = await db
    .select()
    .from(visibilityResults)
    .where(eq(visibilityResults.runId, selectedRun.id));
  return { runs, selectedRun, selectedResults: results };
}

/** Métriques agrégées par solution pour le dashboard. */
export async function getDashboardSummaries(userId: string) {
  const db = getDb();
  const items = await getSolutionsForUser(userId);
  if (!items.length) return [];
  const ids = items.map((s) => s.id);

  const [latestAudits, latestRuns, openRecs] = await Promise.all([
    db
      .select()
      .from(audits)
      .where(inArray(audits.solutionId, ids))
      .orderBy(desc(audits.ranAt)),
    db
      .select()
      .from(visibilityRuns)
      .where(inArray(visibilityRuns.solutionId, ids))
      .orderBy(desc(visibilityRuns.ranAt)),
    db
      .select({ solutionId: recommendations.solutionId, n: count() })
      .from(recommendations)
      .where(
        and(
          inArray(recommendations.solutionId, ids),
          eq(recommendations.status, "pending"),
        ),
      )
      .groupBy(recommendations.solutionId),
  ]);

  return items.map((s) => {
    const audit = latestAudits.find((a) => a.solutionId === s.id) ?? null;
    const run = latestRuns.find((r) => r.solutionId === s.id) ?? null;
    const recs = openRecs.find((r) => r.solutionId === s.id)?.n ?? 0;
    return { solution: s, latestAudit: audit, latestRun: run, openRecommendations: recs };
  });
}

export {
  solutions,
  targetQueries,
  competitors,
  audits,
  recommendations,
  generatedAssets,
  visibilityRuns,
  visibilityResults,
};
