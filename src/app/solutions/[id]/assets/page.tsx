import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getSolutionForUser, getAssets } from "@/lib/db/queries";
import { SiteHeader, SolutionNav } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AssetGeneratorButtons } from "./asset-buttons";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

const ASSET_TYPES = [
  { type: "audit_report" as const, label: "Rapport d'audit global" },
  { type: "llms_txt" as const, label: "llms.txt" },
  { type: "robots_txt" as const, label: "robots.txt" },
  { type: "schema_software" as const, label: "Schema SoftwareApplication" },
  { type: "schema_faq" as const, label: "Schema FAQPage" },
  { type: "faq_draft" as const, label: "Brouillon FAQ" },
  { type: "comparison_draft" as const, label: "Brouillon comparatif" },
];

const ASSET_FILENAMES: Record<string, string> = {
  audit_report: "rapport-audit.md",
  llms_txt: "llms.txt",
  robots_txt: "robots.txt",
  schema_software: "schema-software.json",
  schema_faq: "schema-faq.json",
  faq_draft: "faq.md",
  comparison_draft: "comparatif.md",
};

const DEPLOY_CHECKLIST = [
  "llms.txt publié à la racine (/llms.txt)",
  "robots.txt mis à jour (bots IA autorisés)",
  "JSON-LD SoftwareApplication injecté dans le <head>",
  "JSON-LD FAQPage injecté sur la page FAQ",
  "Page FAQ publiée et liée depuis la homepage",
  "Page comparatif publiée avec date de mise à jour visible",
  "sitemap.xml à jour et soumis à Google Search Console",
];

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const solution = await getSolutionForUser(id, session.user.id);
  if (!solution) notFound();

  const assets = await getAssets(id, session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Assets — {solution.name}</h1>
        <SolutionNav id={id} />

        <div className="mt-6">
          <AssetGeneratorButtons solutionId={id} types={ASSET_TYPES} />
        </div>

        <div className="mt-8 space-y-4">
          {assets.length === 0 ? (
            <p className="text-muted-foreground">
              Générez des assets optimisés pour les agents IA.
            </p>
          ) : (
            assets.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Mis à jour : {a.updatedAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <CopyButton content={a.content} />
                    <a
                      href={`data:text/plain;charset=utf-8,${encodeURIComponent(a.content)}`}
                      download={ASSET_FILENAMES[a.type] ?? `${a.type}.txt`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Télécharger
                    </a>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 text-xs whitespace-pre-wrap">
                    {a.content}
                  </pre>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Checklist de déploiement</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {DEPLOY_CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Après chaque publication, relancez un run monitoring (avec une note)
              pour mesurer l&apos;impact sur la part de voix.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
