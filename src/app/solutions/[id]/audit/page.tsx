import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionWithRelations, getLatestAudit } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runAuditAction } from "@/lib/actions";
import type { TechnicalChecks } from "@/lib/audit/engine";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const data = await getSolutionWithRelations(id, session.user.id);
  if (!data) notFound();

  const audit = await getLatestAudit(id, session.user.id);
  const checks = audit?.technicalChecks as TechnicalChecks | undefined;
  const pipeline = (audit?.pipelineScores ?? {}) as Record<string, number>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Audit — {data.solution.name}</h1>
        <SolutionNav id={id} />

        <div className="mt-6 flex gap-3">
          <form action={runAuditAction.bind(null, id)}>
            <Button type="submit">
              {audit ? "Relancer l'audit" : "Lancer l'audit"}
            </Button>
          </form>
        </div>

        {!audit ? (
          <p className="mt-8 text-muted-foreground">
            Aucun audit. Lancez un audit pour analyser votre site.
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { key: "retrieval", label: "Récupération" },
                { key: "scoring", label: "Scoring" },
                { key: "synthesis", label: "Synthèse" },
              ].map(({ key, label }) => (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-2xl font-bold">{pipeline[key] ?? 0}</span>
                    <span className="text-muted-foreground">/100</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            {checks && (
              <Card>
                <CardHeader>
                  <CardTitle>Checklist technique</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Check ok={checks.statusCode === 200} label="Site accessible (HTTP 200)" />
                  <Check ok={checks.robotsTxt.exists} label="robots.txt présent" />
                  <Check ok={checks.robotsTxt.allowsAiBots.GPTBot} label="GPTBot autorisé" />
                  <Check ok={checks.robotsTxt.allowsAiBots.PerplexityBot} label="PerplexityBot autorisé" />
                  <Check ok={checks.llmsTxt.exists} label="llms.txt présent" />
                  <Check ok={checks.sitemap.exists} label="sitemap.xml présent" />
                  <Check ok={checks.schema.hasFaqPage} label="Schema FAQPage" />
                  <Check ok={checks.schema.hasSoftwareApplication} label="Schema SoftwareApplication" />
                  <Check ok={checks.meta.hasVisibleDate} label="Date de mise à jour visible" />
                  <Check ok={checks.structure.hasFaqSection} label="Section FAQ détectée" />
                  <Check ok={checks.structure.hasComparisonHints} label="Contenu comparatif détecté" />
                  <p className="pt-2 text-muted-foreground">
                    Temps de réponse : {checks.responseTimeMs}ms
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={ok ? "default" : "secondary"}>{ok ? "OK" : "Gap"}</Badge>
      <span>{label}</span>
    </div>
  );
}
