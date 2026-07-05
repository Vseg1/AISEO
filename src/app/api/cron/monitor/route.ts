import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  solutions,
  targetQueries,
  competitors,
  visibilityRuns,
  visibilityResults,
} from "../../../../../drizzle/schema";
import { runVisibilityMonitor, computeShareOfVoice } from "@/lib/monitor/platforms";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const allSolutions = await db.select().from(solutions);
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

    const results = await runVisibilityMonitor(
      queries.map((q) => q.query),
      solution.name,
      solution.url,
      comps.map((c) => c.name),
    );

    const shareOfVoice = computeShareOfVoice(results, (r) => r.mentioned);
    const [run] = await db
      .insert(visibilityRuns)
      .values({ solutionId: solution.id, shareOfVoice })
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
    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
