import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  solutions,
  targetQueries,
  competitors,
  visibilityRuns,
  visibilityResults,
} from "../../../../../drizzle/schema";
import {
  runVisibilityMonitor,
  computeShareOfVoice,
  computePlatformSov,
  getPlatformStatuses,
} from "@/lib/monitor/platforms";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sans aucune clé configurée, tous les résultats seraient simulés — inutile.
  if (!getPlatformStatuses().some((p) => p.active)) {
    console.log(JSON.stringify({ cron: "monitor", status: "skipped", reason: "no API keys" }));
    return NextResponse.json({ ok: true, processed: 0, reason: "no API keys" });
  }

  const db = getDb();
  const allSolutions = await db
    .select()
    .from(solutions)
    .where(eq(solutions.monitoringEnabled, true));
  let processed = 0;

  for (const solution of allSolutions) {
    const queries = await db
      .select()
      .from(targetQueries)
      .where(eq(targetQueries.solutionId, solution.id));
    const comps = await db
      .select()
      .from(competitors)
      .where(eq(competitors.solutionId, solution.id));

    if (!queries.length) continue;

    try {
      const results = await runVisibilityMonitor(
        queries.map((q) => q.query),
        solution.name,
        solution.url,
        comps.map((c) => c.name),
        solution.language ?? "fr",
      );

      const shareOfVoice = computeShareOfVoice(results);
      const platformSov = computePlatformSov(results);
      const [run] = await db
        .insert(visibilityRuns)
        .values({ solutionId: solution.id, shareOfVoice, platformSov, note: "cron" })
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
      processed++;
      console.log(
        JSON.stringify({ cron: "monitor", solutionId: solution.id, status: "ok", sov: shareOfVoice }),
      );
    } catch (e) {
      console.log(
        JSON.stringify({
          cron: "monitor",
          solutionId: solution.id,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  return NextResponse.json({ ok: true, processed });
}
