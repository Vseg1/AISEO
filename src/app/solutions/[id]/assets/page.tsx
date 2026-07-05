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

export const dynamic = "force-dynamic";

const ASSET_TYPES = [
  { type: "llms_txt" as const, label: "llms.txt" },
  { type: "robots_txt" as const, label: "robots.txt" },
  { type: "schema_software" as const, label: "Schema SoftwareApplication" },
  { type: "schema_faq" as const, label: "Schema FAQPage" },
  { type: "faq_draft" as const, label: "Brouillon FAQ" },
  { type: "comparison_draft" as const, label: "Brouillon comparatif" },
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
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <a
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(a.content)}`}
                    download={`${a.type}.txt`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Télécharger
                  </a>
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
      </main>
    </>
  );
}
