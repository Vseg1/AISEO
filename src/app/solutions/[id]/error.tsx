"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SolutionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Une erreur est survenue</CardTitle>
          <CardDescription>
            {error.message ||
              "Le site audité est peut-être injoignable, ou une API externe n'a pas répondu."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>Réessayer</Button>
        </CardContent>
      </Card>
    </main>
  );
}
