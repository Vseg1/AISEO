import type { TechnicalChecks } from "@/lib/audit/engine";

export type RecommendationInput = {
  title: string;
  description: string;
  tier: string;
  effort: "faible" | "moyen" | "élevé";
  priority: "haute" | "moyenne" | "basse";
  assetType?:
    | "llms_txt"
    | "schema_faq"
    | "schema_software"
    | "faq_draft"
    | "comparison_draft"
    | "robots_txt"
    | null;
};

export function buildRecommendations(
  checks: TechnicalChecks,
): RecommendationInput[] {
  const recs: RecommendationInput[] = [];

  if (!checks.llmsTxt.exists) {
    recs.push({
      title: "Publier un fichier llms.txt",
      description:
        "Créez /llms.txt à la racine pour aider les crawlers IA à indexer vos pages clés.",
      tier: "transversal",
      effort: "faible",
      priority: "moyenne",
      assetType: "llms_txt",
    });
  }

  if (
    !checks.robotsTxt.exists ||
    !checks.robotsTxt.allowsAiBots.GPTBot ||
    !checks.robotsTxt.allowsAiBots["OAI-SearchBot"]
  ) {
    recs.push({
      title: "Autoriser les crawlers IA dans robots.txt",
      description:
        "GPTBot et OAI-SearchBot doivent pouvoir crawler votre site pour apparaître dans ChatGPT Search.",
      tier: "chatgpt",
      effort: "faible",
      priority: "haute",
      assetType: "robots_txt",
    });
  }

  if (!checks.robotsTxt.allowsAiBots.PerplexityBot) {
    recs.push({
      title: "Autoriser PerplexityBot",
      description:
        "Perplexity cite les sources web — bloquer PerplexityBot vous rend invisible sur cette plateforme.",
      tier: "perplexity",
      effort: "faible",
      priority: "haute",
      assetType: "robots_txt",
    });
  }

  if (!checks.schema.hasFaqPage) {
    recs.push({
      title: "Ajouter un schema FAQPage",
      description:
        "JSON-LD FAQPage augmente vos chances d'apparaître dans Google AI Overviews.",
      tier: "google_aio",
      effort: "faible",
      priority: "moyenne",
      assetType: "schema_faq",
    });
  }

  if (!checks.schema.hasSoftwareApplication && !checks.schema.hasProduct) {
    recs.push({
      title: "Ajouter un schema SoftwareApplication",
      description:
        "Structurez votre produit SaaS pour les moteurs de recherche et agents IA.",
      tier: "google_aio",
      effort: "faible",
      priority: "moyenne",
      assetType: "schema_software",
    });
  }

  if (!checks.meta.hasVisibleDate) {
    recs.push({
      title: "Afficher une date de mise à jour",
      description:
        "ChatGPT favorise le contenu récent (76% des citations < 30 jours). Affichez 'Dernière mise à jour'.",
      tier: "chatgpt",
      effort: "faible",
      priority: "haute",
      assetType: null,
    });
  }

  if (!checks.structure.hasComparisonHints) {
    recs.push({
      title: "Créer une page comparatif",
      description:
        "Publiez 'X vs Y vs Z' avec critères explicites — format privilégié par Perplexity et ChatGPT.",
      tier: "perplexity",
      effort: "moyen",
      priority: "haute",
      assetType: "comparison_draft",
    });
  }

  if (!checks.structure.hasFaqSection) {
    recs.push({
      title: "Publier une FAQ structurée",
      description:
        "Réponses directes (40–60 mots) sous titres interrogatifs — format answer-first pour AIO.",
      tier: "google_aio",
      effort: "moyen",
      priority: "moyenne",
      assetType: "faq_draft",
    });
  }

  if (!checks.sitemap.exists) {
    recs.push({
      title: "Publier un sitemap.xml",
      description:
        "Facilite l'indexation Google et Bing — prérequis pour AI Overviews et ChatGPT browse.",
      tier: "google_aio",
      effort: "faible",
      priority: "moyenne",
      assetType: null,
    });
  }

  if (!checks.structure.hasPricingHints) {
    recs.push({
      title: "Page pricing indexable",
      description:
        "Les agents comparent les solutions — une page tarifs claire améliore la pertinence intent.",
      tier: "transversal",
      effort: "moyen",
      priority: "basse",
      assetType: null,
    });
  }

  recs.push({
    title: "Renforcer la présence Reddit / G2",
    description:
      "Perplexity cite Reddit ~47% du temps. Participez authentiquement et collectez des reviews G2/Capterra.",
    tier: "perplexity",
    effort: "élevé",
    priority: "moyenne",
    assetType: null,
  });

  return recs;
}
