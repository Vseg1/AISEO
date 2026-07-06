"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAssetAction, generateAuditReportAction } from "@/lib/actions";

type AssetType =
  | "audit_report"
  | "llms_txt"
  | "schema_faq"
  | "schema_software"
  | "faq_draft"
  | "comparison_draft"
  | "robots_txt";

export function AssetGeneratorButtons({
  solutionId,
  types,
}: {
  solutionId: string;
  types: { type: AssetType; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {types.map(({ type, label }) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                if (type === "audit_report") {
                  await generateAuditReportAction(solutionId);
                } else {
                  await generateAssetAction(solutionId, type);
                }
                toast.success(`${label} généré`);
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : `Échec de la génération de ${label}`,
                );
              }
            })
          }
        >
          Générer {label}
        </Button>
      ))}
    </div>
  );
}
