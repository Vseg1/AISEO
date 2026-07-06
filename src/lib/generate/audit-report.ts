import type { TechnicalChecks } from "@/lib/audit/engine";

export type AuditReportInput = {
  solution: {
    name: string;
    url: string;
    type: string;
    language: string | null;
    description: string | null;
    category: string | null;
    markets: string[];
    personas: string[];
    useCases: string[];
    integrations: string[];
  };
  audit: {
    overallScore: number | null;
    ranAt: Date;
    pipelineScores: Record<string, number>;
    platformScores: Record<string, number>;
    semanticScores: Record<string, number>;
    technicalChecks: TechnicalChecks;
  };
  queries: string[];
  competitors: { name: string; url?: string | null }[];
  recommendations: {
    title: string;
    description: string;
    tier: string;
    effort: string;
    priority: string;
    status: string;
    assetType: string | null;
  }[];
  monitoring?: {
    shareOfVoice: number | null;
    ranAt: Date;
    platformSov: Record<string, number>;
    note: string | null;
    results: {
      platform: string;
      query: string;
      mentioned: boolean;
      competitorsMentioned: string[];
    }[];
  };
};

const PLATFORM_LABELS: Record<string, string> = {
  google_aio: "Google AI Overviews",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
};

function checkLine(ok: boolean, label: string) {
  return `- [${ok ? "x" : " "}] ${label}`;
}

function priorityEmoji(p: string) {
  if (p === "haute") return "🔴";
  if (p === "moyenne") return "🟡";
  return "⚪";
}

export function generateAuditReport(data: AuditReportInput): string {
  const { solution, audit, queries, competitors, recommendations, monitoring } =
    data;
  const c = audit.technicalChecks;
  const date = audit.ranAt.toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(
    `# Rapport d'audit visibilité agents IA`,
    ``,
    `**${solution.name}** — ${solution.url}`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Date de l'audit | ${date} |`,
    `| Type | ${solution.type} |`,
    `| Langue | ${solution.language ?? "fr"} |`,
    `| Marchés | ${solution.markets.join(", ") || "—"} |`,
    `| Score readiness global | **${audit.overallScore ?? "—"}/100** |`,
    monitoring?.shareOfVoice != null
      ? `| Part de voix (dernier run) | **${monitoring.shareOfVoice}%** (${monitoring.ranAt.toISOString().slice(0, 10)}) |`
      : `| Part de voix | Non mesurée — lancer un run monitoring |`,
    ``,
  );

  // --- Synthèse ---
  const gaps: string[] = [];
  if (!c.llmsTxt.exists) gaps.push("llms.txt absent");
  if (!c.robotsTxt.exists || !c.robotsTxt.allowsAiBots.GPTBot)
    gaps.push("crawlers IA non autorisés");
  if (!c.sitemap.exists) gaps.push("sitemap.xml absent");
  if (!c.schema.hasFaqPage && !c.structure.hasFaqSection)
    gaps.push("pas de FAQ");
  if (!c.schema.hasSoftwareApplication) gaps.push("pas de schema SoftwareApplication");
  if (!c.structure.hasComparisonHints) gaps.push("pas de comparatif");
  if (!c.meta.hasVisibleDate) gaps.push("pas de date de mise à jour");

  lines.push(
    `## 1. Synthèse exécutive`,
    ``,
    solution.description ?? "",
    ``,
    gaps.length > 0
      ? `**Principaux gaps** (${gaps.length}) : ${gaps.join(" · ")}.`
      : `**Aucun gap majeur détecté** — maintenir le monitoring et enrichir le contenu.`,
    ``,
    `**Recommandations** : ${recommendations.filter((r) => r.status === "pending").length} action(s) en attente sur ${recommendations.length} au total.`,
    ``,
  );

  // --- Scores ---
  lines.push(`## 2. Scores readiness agents IA`, ``);
  lines.push(`### Pipeline agent (récupération → scoring → synthèse)`, ``);
  lines.push(
    `| Étape | Score |`,
    `|-------|-------|`,
    `| Récupération (crawl, robots, llms.txt) | ${audit.pipelineScores.retrieval ?? 0}/100 |`,
    `| Scoring (schema, meta, fraîcheur) | ${audit.pipelineScores.scoring ?? 0}/100 |`,
    `| Synthèse (FAQ, comparatif, pricing) | ${audit.pipelineScores.synthesis ?? 0}/100 |`,
    ``,
  );
  lines.push(`### Scores par plateforme Tier 1`, ``);
  lines.push(`| Plateforme | Score readiness |`, `|-----------|-----------------|`);
  const platformRows: [string, string][] = [
    ["google_aio", "Google AI Overviews"],
    ["chatgpt", "ChatGPT"],
    ["perplexity", "Perplexity"],
  ];
  for (const [key, label] of platformRows) {
    const score = audit.platformScores[key];
    if (score != null) lines.push(`| ${label} | ${score}/100 |`);
  }
  lines.push(``);

  // --- Profil ---
  lines.push(`## 3. Profil & requêtes cibles`, ``);
  if (solution.personas.length)
    lines.push(`**Personas** : ${solution.personas.join(", ")}`, ``);
  if (solution.useCases.length)
    lines.push(`**Cas d'usage** :`, ...solution.useCases.map((u) => `- ${u}`), ``);
  if (solution.integrations.length)
    lines.push(`**Intégrations** : ${solution.integrations.join(", ")}`, ``);
  lines.push(`**Requêtes cibles monitorées** :`, ...queries.map((q) => `- ${q}`), ``);
  if (competitors.length) {
    lines.push(
      `**Concurrents suivis** :`,
      ...competitors.map(
        (co) => `- ${co.name}${co.url ? ` (${co.url})` : ""}`,
      ),
      ``,
    );
  }

  // --- Technique ---
  lines.push(
    `## 4. Audit technique`,
    ``,
    `Site crawlé : ${c.crawledPages} page(s) · Temps de réponse : ${c.responseTimeMs} ms · HTTP ${c.statusCode}`,
    ``,
    checkLine(c.statusCode === 200, "Site accessible (HTTP 200)"),
    checkLine(c.robotsTxt.exists, "robots.txt présent"),
    checkLine(c.robotsTxt.allowsAiBots.GPTBot, "GPTBot autorisé"),
    checkLine(c.robotsTxt.allowsAiBots["OAI-SearchBot"], "OAI-SearchBot autorisé"),
    checkLine(c.robotsTxt.allowsAiBots.PerplexityBot, "PerplexityBot autorisé"),
    checkLine(c.robotsTxt.allowsAiBots.ClaudeBot, "ClaudeBot autorisé"),
    checkLine(c.robotsTxt.allowsAiBots["Google-Extended"], "Google-Extended autorisé"),
    checkLine(c.llmsTxt.exists, "llms.txt présent à la racine"),
    checkLine(c.sitemap.exists, "sitemap.xml présent"),
    checkLine(c.schema.hasFaqPage, "Schema FAQPage (JSON-LD)"),
    checkLine(c.schema.hasSoftwareApplication, "Schema SoftwareApplication"),
    checkLine(c.schema.hasOrganization, "Schema Organization"),
    checkLine(Boolean(c.meta.description), "Meta description renseignée"),
    checkLine(c.meta.hasVisibleDate, "Date de mise à jour visible"),
    checkLine(c.structure.hasFaqSection, "Section FAQ dans le contenu"),
    checkLine(c.structure.hasComparisonHints, "Contenu comparatif détecté"),
    checkLine(c.structure.hasPricingHints, "Indications tarifaires détectées"),
    ``,
  );

  // --- Sémantique ---
  if (Object.keys(audit.semanticScores).length > 0) {
    lines.push(`## 5. Intent match (audit sémantique)`, ``);
    lines.push(
      `Évalue si la homepage répond directement à chaque requête cible.`,
      ``,
      `| Requête | Score |`,
      `|---------|-------|`,
    );
    for (const [q, score] of Object.entries(audit.semanticScores)) {
      lines.push(`| ${q} | ${score}/100 |`);
    }
    lines.push(``);
  }

  // --- Monitoring ---
  if (monitoring) {
    lines.push(`## 6. Monitoring visibilité`, ``);
    lines.push(
      `Dernier run : ${monitoring.ranAt.toISOString().slice(0, 10)}${monitoring.note ? ` — *${monitoring.note}*` : ""}`,
      ``,
      `**Part de voix globale : ${monitoring.shareOfVoice ?? 0}%**`,
      ``,
    );
    if (Object.keys(monitoring.platformSov).length) {
      lines.push(`| Plateforme | Part de voix |`, `|-----------|--------------|`);
      for (const [p, sov] of Object.entries(monitoring.platformSov)) {
        lines.push(`| ${PLATFORM_LABELS[p] ?? p} | ${sov}% |`);
      }
      lines.push(``);
    }
    const configured = monitoring.results.filter((r) => r.mentioned || true);
    if (configured.length) {
      lines.push(`| Plateforme | Requête | Mention | Concurrents cités |`);
      lines.push(`|-----------|---------|---------|-------------------|`);
      for (const r of monitoring.results) {
        lines.push(
          `| ${PLATFORM_LABELS[r.platform] ?? r.platform} | ${r.query.slice(0, 50)} | ${r.mentioned ? "Oui" : "Non"} | ${r.competitorsMentioned.join(", ") || "—"} |`,
        );
      }
      lines.push(``);
    }
  }

  // --- Plan d'action ---
  const sectionNum = monitoring ? 7 : Object.keys(audit.semanticScores).length > 0 ? 6 : 5;
  lines.push(`## ${sectionNum}. Plan d'action priorisé`, ``);
  const pending = recommendations.filter((r) => r.status === "pending");
  const done = recommendations.filter((r) => r.status === "done");
  if (pending.length === 0) {
    lines.push(`Toutes les recommandations ont été traitées.`, ``);
  } else {
    for (const r of pending) {
      lines.push(
        `### ${priorityEmoji(r.priority)} ${r.title}`,
        ``,
        `- **Tier** : ${r.tier} · **Effort** : ${r.effort} · **Priorité** : ${r.priority}`,
        `- ${r.description}`,
        r.assetType ? `- Asset associé : \`${r.assetType}\` (générable depuis AISEO)` : "",
        ``,
      );
    }
  }
  if (done.length) {
    lines.push(`### Actions déjà réalisées`, ``);
    for (const r of done) lines.push(`- [x] ${r.title}`);
    lines.push(``);
  }

  lines.push(
    `## Prochaines étapes`,
    ``,
    `1. Traiter les recommandations haute priorité (robots.txt, llms.txt, schema)`,
    `2. Générer et publier les assets depuis AISEO`,
    `3. Relancer un run monitoring avec une note (ex : « llms.txt publié »)`,
    `4. Mesurer l'évolution de la part de voix sur 4 semaines`,
  );
  lines.push(
    ``,
    `---`,
    `*Généré par AISEO — ${new Date().toISOString().slice(0, 10)}*`,
  );

  return lines.join("\n");
}
