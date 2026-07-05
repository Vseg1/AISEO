import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionForUser, getRecommendations } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { updateRecommendationStatus } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const solution = await getSolutionForUser(id, session.user.id);
  if (!solution) notFound();

  const recs = await getRecommendations(id, session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Recommandations — {solution.name}</h1>
        <SolutionNav id={id} />

        {recs.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            Lancez un audit pour générer des recommandations.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {recs.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{r.title}</CardTitle>
                    <Badge variant="outline">{r.tier}</Badge>
                    <Badge variant="secondary">{r.effort}</Badge>
                    <Badge
                      variant={
                        r.priority === "haute"
                          ? "default"
                          : r.priority === "moyenne"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {r.priority}
                    </Badge>
                    <Badge>{r.status}</Badge>
                  </div>
                  <CardDescription>{r.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <form
                    action={updateRecommendationStatus.bind(
                      null,
                      r.id,
                      id,
                      "done",
                    )}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Marquer fait
                    </Button>
                  </form>
                  {r.assetType && (
                    <Link
                      href={`/solutions/${id}/assets`}
                      className={buttonVariants({ size: "sm", variant: "link" })}
                    >
                      Générer asset →
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
