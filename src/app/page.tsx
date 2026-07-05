import Link from "next/link";
import { ArrowRight, Bot, BarChart3, FileText, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            Visibilité agents IA
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Améliorez la visibilité de votre SaaS
            <br />
            <span className="text-muted-foreground">auprès des agents IA</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Audit technique, recommandations par plateforme, génération d&apos;assets
            (llms.txt, schema.org) et monitoring de votre part de voix sur ChatGPT,
            Perplexity et Google AI Overviews.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/onboarding" className={buttonVariants({ size: "lg" })}>
              Analyser ma solution
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Se connecter
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: BarChart3,
                title: "Audit",
                desc: "Score readiness agent : robots.txt, schema, llms.txt, structure.",
              },
              {
                icon: Sparkles,
                title: "Recommandations",
                desc: "Actions priorisées par Tier : AIO, ChatGPT, Perplexity.",
              },
              {
                icon: FileText,
                title: "Génération",
                desc: "llms.txt, JSON-LD, FAQ et comparatifs prêts à déployer.",
              },
              {
                icon: Bot,
                title: "Monitoring",
                desc: "Part de voix agent sur vos requêtes cibles vs concurrents.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg border bg-background p-5">
                <Icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
