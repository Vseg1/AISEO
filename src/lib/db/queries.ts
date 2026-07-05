import { eq, and, desc } from "drizzle-orm";
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

export async function getVisibilityHistory(solutionId: string, userId: string) {
  const solution = await getSolutionForUser(solutionId, userId);
  if (!solution) return { runs: [], latestResults: [] };
  const db = getDb();
  const runs = await db
    .select()
    .from(visibilityRuns)
    .where(eq(visibilityRuns.solutionId, solutionId))
    .orderBy(desc(visibilityRuns.ranAt))
    .limit(20);
  if (runs.length === 0) return { runs: [], latestResults: [] };
  const results = await db
    .select()
    .from(visibilityResults)
    .where(eq(visibilityResults.runId, runs[0].id));
  return { runs, latestResults: results };
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
