"use client";

import { Button } from "@/components/ui/button";
import { generateAssetAction } from "@/lib/actions";

type AssetType =
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
  return (
    <div className="flex flex-wrap gap-2">
      {types.map(({ type, label }) => (
        <form
          key={type}
          action={async () => {
            await generateAssetAction(solutionId, type);
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Générer {label}
          </Button>
        </form>
      ))}
    </div>
  );
}
