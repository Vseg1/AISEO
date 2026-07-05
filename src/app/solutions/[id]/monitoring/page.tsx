import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionForUser, getVisibilityHistory } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { runMonitorAction } from "@/lib/actions";
import { MonitoringChart } from "./monitoring-chart";

export const dynamic = "force-dynamic";

export default async function MonitoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const solution = await getSolutionForUser(id, session.user.id);
  if (!solution) notFound();

  const history = await getVisibilityHistory(id, session.user.id);
  const runs = history.runs;
  const latestResults = history.latestResults;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Monitoring — {solution.name}</h1>
        <SolutionNav id={id} />

        <div className="mt-6 flex items-center gap-4">
          <form action={runMonitorAction.bind(null, id)}>
            <Button type="submit">Lancer un run monitoring</Button>
          </form>
          {runs[0]?.shareOfVoice != null && (
            <Card className="px-4 py-2">
              <span className="text-sm text-muted-foreground">Part de voix : </span>
              <span className="text-xl font-bold">{runs[0].shareOfVoice}%</span>
            </Card>
          )}
        </div>

        {runs.length > 0 && (
          <div className="mt-8">
            <MonitoringChart
              data={runs
                .slice()
                .reverse()
                .map((r) => ({
                  date: r.ranAt.toISOString().slice(0, 10),
                  shareOfVoice: r.shareOfVoice ?? 0,
                }))}
            />
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Derniers résultats</CardTitle>
          </CardHeader>
          <CardContent>
            {latestResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun run. Configurez PERPLEXITY_API_KEY, OPENAI_API_KEY et
                SERPAPI_API_KEY pour des résultats réels.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Requête</TableHead>
                    <TableHead>Mention</TableHead>
                    <TableHead>Rang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestResults.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.platform}</TableCell>
                      <TableCell className="max-w-xs truncate">{r.query}</TableCell>
                      <TableCell>
                        <Badge variant={r.mentioned ? "default" : "secondary"}>
                          {r.mentioned ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.mentionRank ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
