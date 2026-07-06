import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionWithRelations, getLatestAudit } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runAuditAction, generateAuditReportAction } from "@/lib/actions";
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
  const semantic = (audit?.semanticScores ?? {}) as Record<string, number>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Audit — {data.solution.name}</h1>
        <SolutionNav id={id} />

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={runAuditAction.bind(null, id)}>
            <SubmitButton pendingLabel="Audit en cours…">
              {audit ? "Relancer l'audit" : "Lancer l'audit"}
            </SubmitButton>
          </form>
          {audit && (
            <form action={generateAuditReportAction.bind(null, id)}>
              <SubmitButton pendingLabel="Génération…" variant="outline">
                Générer le rapport d&apos;audit
              </SubmitButton>
            </form>
          )}
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

            {Object.keys(semantic).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Intent match (audit sémantique)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {Object.entries(semantic).map(([query, score]) => (
                    <div key={query} className="flex items-center justify-between gap-4">
                      <span className="truncate">{query}</span>
                      <Badge
                        variant={
                          score >= 70 ? "default" : score >= 40 ? "secondary" : "outline"
                        }
                      >
                        {score}/100
                      </Badge>
                    </div>
                  ))}
                  <p className="pt-2 text-xs text-muted-foreground">
                    Évalué par Gemini : la homepage répond-elle directement à chaque
                    requête cible ?
                  </p>
                </CardContent>
              </Card>
            )}

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
                  <Check ok={checks.robotsTxt.allowsAiBots.ClaudeBot} label="ClaudeBot autorisé" />
                  <Check ok={checks.robotsTxt.allowsAiBots["Google-Extended"]} label="Google-Extended autorisé" />
                  <Check ok={checks.llmsTxt.exists} label="llms.txt présent" />
                  <Check ok={checks.sitemap.exists} label="sitemap.xml présent" />
                  <Check ok={checks.schema.hasFaqPage} label="Schema FAQPage" />
                  <Check ok={checks.schema.hasSoftwareApplication} label="Schema SoftwareApplication" />
                  <Check ok={checks.schema.hasOrganization} label="Schema Organization" />
                  <Check ok={Boolean(checks.meta.description)} label="Meta description" />
                  <Check ok={checks.meta.hasVisibleDate} label="Date de mise à jour visible" />
                  <Check ok={checks.structure.hasFaqSection} label="Section FAQ détectée" />
                  <Check ok={checks.structure.hasComparisonHints} label="Contenu comparatif détecté" />
                  <p className="pt-2 text-muted-foreground">
                    Temps de réponse : {checks.responseTimeMs}ms —{" "}
                    {checks.crawledPages} page(s) analysée(s)
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
