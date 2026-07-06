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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  updateSolution,
  addTargetQuery,
  deleteTargetQuery,
  addCompetitor,
  deleteCompetitor,
} from "@/lib/actions";
import { getMonitorQueryLimit } from "@/lib/monitor/platforms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const data = await getSolutionWithRelations(id, session.user.id);
  if (!data) notFound();

  const { solution, queries, competitors } = data;
  const queryLimit = getMonitorQueryLimit();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Paramètres — {solution.name}</h1>
        <SolutionNav id={id} />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>
                Nom, URL et description alimentent l&apos;audit et la détection
                des mentions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={updateSolution.bind(null, id)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={solution.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL principale</Label>
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    defaultValue={solution.url}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={solution.description ?? ""}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language">Langue</Label>
                    <Input
                      id="language"
                      name="language"
                      defaultValue={solution.language ?? "fr"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="markets">Marchés (un par ligne)</Label>
                    <Textarea
                      id="markets"
                      name="markets"
                      rows={2}
                      defaultValue={(solution.markets ?? []).join("\n")}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="monitoringEnabled"
                    name="monitoringEnabled"
                    type="checkbox"
                    defaultChecked={solution.monitoringEnabled}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="monitoringEnabled">
                    Monitoring hebdomadaire automatique (cron)
                  </Label>
                </div>
                <Button type="submit">Enregistrer</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Requêtes cibles</CardTitle>
                <CardDescription>
                  {queries.length} requête(s) — les {queryLimit} premières sont
                  suivies par run ({queryLimit === 3 ? "mode gratuit" : "mode étendu"}).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {queries.map((q, i) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {i < queryLimit ? (
                          <Badge variant="default">suivie</Badge>
                        ) : (
                          <Badge variant="outline">hors quota</Badge>
                        )}
                        {q.query}
                      </span>
                      <form action={deleteTargetQuery.bind(null, id, q.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          Supprimer
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form
                  action={addTargetQuery.bind(null, id)}
                  className="flex gap-2"
                >
                  <Input
                    name="query"
                    placeholder="ex : meilleur CRM pour PME France"
                    required
                  />
                  <Button type="submit" variant="outline">
                    Ajouter
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Concurrents</CardTitle>
                <CardDescription>
                  Détectés dans les réponses agents pour le comparatif de part
                  de voix.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {competitors.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        {c.name}
                        {c.url && (
                          <span className="ml-2 text-muted-foreground">
                            {c.url}
                          </span>
                        )}
                      </span>
                      <form action={deleteCompetitor.bind(null, id, c.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          Supprimer
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form
                  action={addCompetitor.bind(null, id)}
                  className="flex flex-wrap gap-2"
                >
                  <Input name="name" placeholder="Nom" required className="flex-1" />
                  <Input name="url" placeholder="URL (optionnel)" className="flex-1" />
                  <Button type="submit" variant="outline">
                    Ajouter
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
