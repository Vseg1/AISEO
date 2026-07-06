import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDashboardSummaries } from "@/lib/db/queries";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const summaries = await getDashboardSummaries(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Bonjour {session.user.name ?? session.user.email}
            </p>
          </div>
          <Link href="/onboarding" className={buttonVariants()}>
            + Nouvelle solution
          </Link>
        </div>

        {summaries.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucune solution</CardTitle>
              <CardDescription>
                Ajoutez votre site, webapp ou SaaS pour démarrer l&apos;audit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/onboarding" className={buttonVariants()}>
                Commencer
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map(({ solution: s, latestAudit, latestRun, openRecommendations }) => (
              <Link key={s.id} href={`/solutions/${s.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{s.name}</CardTitle>
                      <Badge variant="secondary">{s.type}</Badge>
                    </div>
                    <CardDescription className="truncate">{s.url}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Score audit</span>
                      <span className="font-medium">
                        {latestAudit?.overallScore != null
                          ? `${latestAudit.overallScore}/100`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Part de voix</span>
                      <span className="font-medium">
                        {latestRun?.shareOfVoice != null
                          ? `${latestRun.shareOfVoice}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Dernier monitoring
                      </span>
                      <span className="font-medium">
                        {latestRun
                          ? latestRun.ranAt.toISOString().slice(0, 10)
                          : "jamais"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Recos ouvertes
                      </span>
                      <span className="font-medium">{openRecommendations}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
