"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { createSolution } from "@/lib/actions";

const STEPS = ["Identité", "Positionnement", "Concurrence", "Visibilité"];

type OnboardingData = {
  name: string;
  url: string;
  type: "website" | "webapp" | "saas";
  language: string;
  markets: string;
  description: string;
  category: string;
  personas: string;
  useCases: string;
  integrations: string;
  competitorNames: string;
  competitorUrls: string;
  queries: string;
  keyPagesPricing: string;
  keyPagesDocs: string;
  keyPagesBlog: string;
};

const initialData: OnboardingData = {
  name: "",
  url: "",
  type: "saas",
  language: "fr",
  markets: "",
  description: "",
  category: "",
  personas: "",
  useCases: "",
  integrations: "",
  competitorNames: "",
  competitorUrls: "",
  queries: "",
  keyPagesPricing: "",
  keyPagesDocs: "",
  keyPagesBlog: "",
};

function validateStep(step: number, data: OnboardingData): string | null {
  if (step === 0) {
    if (!data.name.trim()) return "Le nom de la solution est requis.";
    if (!data.url.trim()) return "L'URL principale est requise.";
    try {
      new URL(data.url);
    } catch {
      return "URL invalide.";
    }
  }
  if (step === 1 && !data.description.trim()) {
    return "La description est requise.";
  }
  if (step === 3 && !data.queries.trim()) {
    return "Ajoutez au moins une requête cible.";
  }
  return null;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set =
    (field: keyof OnboardingData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setData((d) => ({ ...d, [field]: e.target.value }));
      setError(null);
    };

  function goNext() {
    const err = validateStep(step, data);
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep(3, data);
    if (err) {
      setError(err);
      return;
    }
    const fd = new FormData();
    for (const [key, value] of Object.entries(data)) {
      fd.append(key, value);
    }
    startTransition(() => {
      createSolution(fd);
    });
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 rounded-md py-2 text-center text-xs font-medium ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-muted text-foreground"
                    : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {s}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step]}</CardTitle>
            <CardDescription>
              Étape {step + 1} sur {STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              {step === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom de la solution</Label>
                    <Input
                      id="name"
                      value={data.name}
                      onChange={set("name")}
                      required
                      placeholder="Mon SaaS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">URL principale</Label>
                    <Input
                      id="url"
                      type="url"
                      value={data.url}
                      onChange={set("url")}
                      required
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <select
                      id="type"
                      value={data.type}
                      onChange={set("type")}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    >
                      <option value="website">Site web</option>
                      <option value="webapp">Webapp</option>
                      <option value="saas">SaaS</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Langue</Label>
                    <Input
                      id="language"
                      value={data.language}
                      onChange={set("language")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="markets">Marchés (un par ligne)</Label>
                    <Textarea
                      id="markets"
                      value={data.markets}
                      onChange={set("markets")}
                      placeholder={"France\nEurope"}
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={data.description}
                      onChange={set("description")}
                      required
                      rows={3}
                      placeholder="CRM pour PME..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie</Label>
                    <Input
                      id="category"
                      value={data.category}
                      onChange={set("category")}
                      placeholder="CRM, Analytics..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personas">Personas cibles (un par ligne)</Label>
                    <Textarea
                      id="personas"
                      value={data.personas}
                      onChange={set("personas")}
                      placeholder={"PME 5-20 employés\nAgences marketing"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="useCases">Cas d&apos;usage</Label>
                    <Textarea
                      id="useCases"
                      value={data.useCases}
                      onChange={set("useCases")}
                      placeholder={"Gestion pipeline\nReporting"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="integrations">Intégrations</Label>
                    <Textarea
                      id="integrations"
                      value={data.integrations}
                      onChange={set("integrations")}
                      placeholder={"Slack\nHubSpot"}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="competitorNames">Concurrents — noms (un par ligne)</Label>
                    <Textarea
                      id="competitorNames"
                      value={data.competitorNames}
                      onChange={set("competitorNames")}
                      placeholder={"Concurrent A\nConcurrent B"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="competitorUrls">URLs concurrents (optionnel, même ordre)</Label>
                    <Textarea
                      id="competitorUrls"
                      value={data.competitorUrls}
                      onChange={set("competitorUrls")}
                      placeholder="https://..."
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="queries">Requêtes cibles (5–20, une par ligne)</Label>
                    <Textarea
                      id="queries"
                      value={data.queries}
                      onChange={set("queries")}
                      required
                      rows={5}
                      placeholder={"meilleur CRM PME France\nalternative à Salesforce PME"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keyPagesPricing">URL page pricing</Label>
                    <Input
                      id="keyPagesPricing"
                      type="url"
                      value={data.keyPagesPricing}
                      onChange={set("keyPagesPricing")}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keyPagesDocs">URL documentation</Label>
                    <Input
                      id="keyPagesDocs"
                      type="url"
                      value={data.keyPagesDocs}
                      onChange={set("keyPagesDocs")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keyPagesBlog">URL blog</Label>
                    <Input
                      id="keyPagesBlog"
                      type="url"
                      value={data.keyPagesBlog}
                      onChange={set("keyPagesBlog")}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-between pt-4">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setStep(step - 1);
                    }}
                  >
                    Précédent
                  </Button>
                ) : (
                  <div />
                )}
                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Suivant
                  </Button>
                ) : (
                  <Button type="submit" disabled={pending}>
                    {pending ? "Création…" : "Créer et analyser"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
