import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionForUser, getVisibilityHistory } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { runMonitorAction } from "@/lib/actions";
import {
  PLATFORM_LABELS,
  getPlatformStatuses,
  getMonitorQueryLimit,
} from "@/lib/monitor/platforms";
import { MonitoringChart } from "./monitoring-chart";

export const dynamic = "force-dynamic";

function buildCsv(
  results: {
    platform: string;
    query: string;
    mentioned: boolean | null;
    mentionRank: number | null;
    competitorsMentioned: string[] | null;
  }[],
) {
  const rows = [
    "platform,query,mentioned,rank,competitors",
    ...results.map((r) =>
      [
        r.platform,
        `"${r.query.replace(/"/g, '""')}"`,
        r.mentioned ? "oui" : "non",
        r.mentionRank ?? "",
        `"${(r.competitorsMentioned ?? []).join("; ")}"`,
      ].join(","),
    ),
  ];
  return rows.join("\n");
}

export default async function MonitoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { run: runParam } = await searchParams;
  const solution = await getSolutionForUser(id, session.user.id);
  if (!solution) notFound();

  const { runs, selectedRun, selectedResults } = await getVisibilityHistory(
    id,
    session.user.id,
    runParam,
  );

  const statuses = getPlatformStatuses();
  const anyActive = statuses.some((s) => s.active);
  const queryLimit = getMonitorQueryLimit();
  const realResults = selectedResults.filter((r) => r.configured !== false);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Monitoring — {solution.name}</h1>
        <SolutionNav id={id} />

        {/* État des plateformes */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plateformes suivies</CardTitle>
            <CardDescription>
              {queryLimit} requêtes suivies par run (
              {queryLimit === 3 ? "mode gratuit" : "mode étendu"}).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {statuses.map((s) => (
              <div
                key={s.platform}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <Badge variant={s.active ? "default" : "secondary"}>
                  {s.active ? "actif" : "inactif"}
                </Badge>
                <span className="font-medium">{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {!anyActive ? (
          <Card className="mt-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-base">
                Aucune plateforme configurée
              </CardTitle>
              <CardDescription>
                Ajoutez au minimum <code className="text-xs">GEMINI_API_KEY</code>{" "}
                (gratuit, aistudio.google.com/apikey) ou{" "}
                <code className="text-xs">OPENAI_API_KEY</code> pour lancer un
                run réel. Sans clé, aucun résultat exploitable n&apos;est
                produit.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <form action={runMonitorAction.bind(null, id)} className="flex gap-2">
              <Input
                name="note"
                placeholder="Note (ex : llms.txt publié)"
                className="w-56"
              />
              <SubmitButton pendingLabel="Run en cours (~30s)…">
                Lancer un run monitoring
              </SubmitButton>
            </form>
            {selectedRun?.shareOfVoice != null && (
              <Card className="px-4 py-2">
                <span className="text-sm text-muted-foreground">
                  Part de voix :{" "}
                </span>
                <span className="text-xl font-bold">
                  {selectedRun.shareOfVoice}%
                </span>
              </Card>
            )}
          </div>
        )}

        {/* SOV par plateforme du run sélectionné */}
        {selectedRun &&
          Object.keys(selectedRun.platformSov ?? {}).length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {Object.entries(selectedRun.platformSov ?? {}).map(
                ([platform, sov]) => (
                  <Card key={platform}>
                    <CardHeader className="pb-1">
                      <CardDescription>
                        {PLATFORM_LABELS[platform] ?? platform}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-2xl font-bold">{sov}%</span>
                      <span className="ml-1 text-sm text-muted-foreground">
                        de mentions
                      </span>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}

        {runs.length > 0 && (
          <div className="mt-8">
            <MonitoringChart
              data={runs
                .slice()
                .reverse()
                .map((r) => ({
                  date: r.ranAt.toISOString().slice(0, 10),
                  shareOfVoice: r.shareOfVoice ?? 0,
                  platformSov: (r.platformSov ?? {}) as Record<string, number>,
                }))}
              platformLabels={PLATFORM_LABELS}
            />
          </div>
        )}

        {/* Historique des runs */}
        {runs.length > 1 && (
          <Card className="mt-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historique des runs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {runs.map((r) => (
                <Link
                  key={r.id}
                  href={`/solutions/${id}/monitoring?run=${r.id}`}
                  className={buttonVariants({
                    size: "sm",
                    variant: r.id === selectedRun?.id ? "default" : "outline",
                  })}
                >
                  {r.ranAt.toISOString().slice(0, 10)} — {r.shareOfVoice ?? 0}%
                  {r.note ? ` (${r.note})` : ""}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Résultats
              {selectedRun && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {selectedRun.ranAt.toISOString().slice(0, 10)}
                  {selectedRun.note ? ` — ${selectedRun.note}` : ""}
                </span>
              )}
            </CardTitle>
            {realResults.length > 0 && (
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(buildCsv(realResults))}`}
                download={`monitoring-${selectedRun?.ranAt.toISOString().slice(0, 10)}.csv`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Export CSV
              </a>
            )}
          </CardHeader>
          <CardContent>
            {realResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun résultat réel. Pour les premiers tests (gratuit) :{" "}
                <code className="text-xs">GEMINI_API_KEY</code> (AI Studio) et{" "}
                <code className="text-xs">OPENAI_API_KEY</code> (gpt-3.5-turbo,
                sans CB). Optionnel : SERPAPI (Google AIO réel), PERPLEXITY,{" "}
                <code className="text-xs">MONITOR_OPENAI_PAID=true</code>.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Requête</TableHead>
                    <TableHead>Mention</TableHead>
                    <TableHead>Rang</TableHead>
                    <TableHead>Concurrents cités</TableHead>
                    <TableHead>Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realResults.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {PLATFORM_LABELS[r.platform] ?? r.platform}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {r.query}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.mentioned ? "default" : "secondary"}>
                          {r.mentioned ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.mentionRank ?? "—"}</TableCell>
                      <TableCell className="max-w-xs">
                        {(r.competitorsMentioned ?? []).length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {(r.competitorsMentioned ?? []).map((c) => (
                              <Badge key={c} variant="outline">
                                {c}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <details>
                          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            Voir
                          </summary>
                          <div className="mt-2 max-w-md space-y-2">
                            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                              {r.rawResponse}
                            </pre>
                            {(r.sources ?? []).length > 0 && (
                              <ul className="text-xs text-muted-foreground">
                                {(r.sources ?? []).map((s) => (
                                  <li key={s} className="truncate">
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </details>
                      </TableCell>
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
