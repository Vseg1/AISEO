import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionWithRelations } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { runAuditAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const data = await getSolutionWithRelations(id, session.user.id);
  if (!data) notFound();

  const { solution, queries, competitors, latestAudit } = data;
  const platformScores = (latestAudit?.platformScores ?? {}) as Record<
    string,
    number
  >;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{solution.name}</h1>
          <p className="text-muted-foreground">{solution.url}</p>
        </div>
        <SolutionNav id={id} />

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Score global</CardTitle>
              <CardDescription>Readiness agents IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {latestAudit?.overallScore ?? "—"}
                {latestAudit ? "/100" : ""}
              </div>
              <form action={runAuditAction.bind(null, id)} className="mt-4">
                <Button type="submit" className="w-full">
                  {latestAudit ? "Relancer l'audit" : "Lancer l'audit"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Scores Tier 1</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "google_aio", label: "Google AI Overviews" },
                { key: "chatgpt", label: "ChatGPT" },
                { key: "perplexity", label: "Perplexity" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{label}</span>
                    <span>{platformScores[key] ?? 0}/100</span>
                  </div>
                  <Progress value={platformScores[key] ?? 0} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requêtes cibles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {queries.map((q) => (
                  <li key={q.id}>{q.query}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Concurrents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {competitors.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
