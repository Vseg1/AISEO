export type SolutionProfile = {
  name: string;
  url: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  markets?: string[];
  personas?: string[];
  useCases?: string[];
  integrations?: string[];
};

export type CompetitorInfo = { name: string; url?: string | null };

export function generateLlmsTxt(
  profile: SolutionProfile,
  keyPages?: Record<string, string>,
  competitors: CompetitorInfo[] = [],
  queries: string[] = [],
) {
  const lines = [
    `# ${profile.name}`,
    "",
    `> ${profile.description ?? "Solution SaaS"}`,
    "",
  ];
  if (profile.category) lines.push(`Catégorie : ${profile.category}`, "");
  if (profile.personas?.length) {
    lines.push(`Pour : ${profile.personas.join(", ")}`, "");
  }
  if (profile.useCases?.length) {
    lines.push("## Cas d'usage", ...profile.useCases.map((u) => `- ${u}`), "");
  }
  lines.push("## Documentation", `- [Homepage](${profile.url})`);
  if (keyPages?.pricing) lines.push(`- [Pricing](${keyPages.pricing})`);
  if (keyPages?.docs) lines.push(`- [Documentation](${keyPages.docs})`);
  if (keyPages?.blog) lines.push(`- [Blog](${keyPages.blog})`);
  if (queries.length) {
    lines.push(
      "",
      "## Questions fréquentes",
      ...queries.map((q) => `- ${q}`),
    );
  }
  if (competitors.length) {
    lines.push(
      "",
      "## Alternatives comparées",
      `${profile.name} se compare à : ${competitors.map((c) => c.name).join(", ")}.`,
    );
  }
  lines.push("", "## Optional", `- [FAQ](${profile.url}/faq)`);
  return lines.join("\n");
}

const AI_BOT_BLOCK = `User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /`;

export function generateRobotsTxtSuggestion(existingRobots?: string) {
  if (existingRobots?.trim()) {
    // Merge : on garde l'existant et on ajoute uniquement les bots IA absents
    const missing = ["GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended"]
      .filter((bot) => !existingRobots.toLowerCase().includes(bot.toLowerCase()))
      .map((bot) => `User-agent: ${bot}\nAllow: /`)
      .join("\n\n");
    if (!missing) return existingRobots;
    return `${existingRobots.trimEnd()}\n\n# --- Ajouté par AISEO : crawlers IA ---\n${missing}\n`;
  }
  return `# Allow AI crawlers for agent visibility
${AI_BOT_BLOCK}

User-agent: *
Allow: /
`;
}

export function generateSchemaSoftware(
  profile: SolutionProfile,
  keyPages?: Record<string, string>,
) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: profile.name,
    url: profile.url,
    applicationCategory: profile.category ?? "BusinessApplication",
    description: profile.description,
    operatingSystem: "Web",
    inLanguage: profile.language ?? "fr",
  };
  if (keyPages?.pricing) {
    schema.offers = {
      "@type": "Offer",
      url: keyPages.pricing,
      priceCurrency: "EUR",
      description: "Voir la page tarifs pour les plans détaillés",
    };
  }
  if (profile.useCases?.length) {
    schema.featureList = profile.useCases.join(", ");
  }
  return JSON.stringify(schema, null, 2);
}

export function generateSchemaFaq(
  profile: SolutionProfile,
  questions: { q: string; a: string }[],
) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: questions.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    null,
    2,
  );
}

/** Q/R par défaut construites depuis le profil (use cases + requêtes cibles). */
export function buildFaqQuestions(
  profile: SolutionProfile,
  queries: string[] = [],
): { q: string; a: string }[] {
  const persona = profile.personas?.[0] ?? "équipes professionnelles";
  const questions: { q: string; a: string }[] = [
    {
      q: `Qu'est-ce que ${profile.name} ?`,
      a: profile.description ?? `${profile.name} est une solution SaaS.`,
    },
    {
      q: `Pour qui est ${profile.name} ?`,
      a: `${profile.name} est conçu pour ${persona}.${profile.markets?.length ? ` Disponible sur : ${profile.markets.join(", ")}.` : ""}`,
    },
  ];
  for (const useCase of (profile.useCases ?? []).slice(0, 2)) {
    questions.push({
      q: `Comment ${profile.name} aide pour « ${useCase} » ?`,
      a: `${profile.name} couvre ce cas d'usage nativement. ${profile.description ?? ""}`.trim(),
    });
  }
  if (profile.integrations?.length) {
    questions.push({
      q: `Quelles intégrations propose ${profile.name} ?`,
      a: `${profile.name} s'intègre avec ${profile.integrations.join(", ")}.`,
    });
  }
  for (const query of queries.slice(0, 2)) {
    questions.push({
      q: query.endsWith("?") ? query : `${query} ?`,
      a: `${profile.name} — ${profile.description ?? "voir notre site"}. Détails sur ${profile.url}.`,
    });
  }
  return questions.slice(0, 6);
}

export function generateFaqDraft(
  profile: SolutionProfile,
  queries: string[] = [],
) {
  const questions = buildFaqQuestions(profile, queries);
  const sections = questions
    .map(({ q, a }) => `## ${q}\n\n${a}`)
    .join("\n\n");
  return `# FAQ — ${profile.name}

${sections}

## Quel est le modèle tarifaire ?

Voir la page pricing pour les plans détaillés et essai gratuit.
`;
}

export function generateComparisonDraft(
  profile: SolutionProfile,
  competitors: CompetitorInfo[],
) {
  const names = [profile.name, ...competitors.map((c) => c.name)];
  const header = `| Critère | ${names.join(" | ")} |`;
  const sep = `| --- | ${names.map(() => "---").join(" | ")} |`;
  const fill = (own: string) =>
    `${own} | ${competitors.map((c) => `À compléter (${c.name})`).join(" | ")}`;
  const rows = [
    `| Cas d'usage principal | ${fill(profile.useCases?.[0] ?? "À compléter")} |`,
    `| Idéal pour | ${fill(profile.personas?.[0] ?? "À compléter")} |`,
    `| Intégrations | ${fill(profile.integrations?.slice(0, 3).join(", ") || "À compléter")} |`,
    `| Marchés | ${fill(profile.markets?.join(", ") || "À compléter")} |`,
    `| Site | ${profile.url} | ${competitors.map((c) => c.url ?? "—").join(" | ")} |`,
  ];
  return `# Comparatif : ${names.join(" vs ")}

${header}
${sep}
${rows.join("\n")}

> Remplacez les cellules « À compléter » par des faits vérifiables sur chaque concurrent.
> Les agents IA privilégient les comparatifs factuels et datés — ajoutez une date de mise à jour visible.

## Verdict

${profile.name} se distingue pour ${profile.personas?.[0] ?? "son positionnement ciblé"}${profile.useCases?.[0] ? ` sur « ${profile.useCases[0]} »` : ""}. Évaluez selon vos contraintes budget, stack et taille d'équipe.
`;
}

export async function generateWithLlm(
  type: string,
  profile: SolutionProfile,
  competitors: CompetitorInfo[],
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI();
  const prompt = `Génère un contenu ${type} en ${profile.language === "en" ? "anglais" : "français"} pour optimiser la visibilité agents IA.
Produit: ${profile.name} (${profile.url})
Description: ${profile.description}
Catégorie: ${profile.category}
Personas: ${profile.personas?.join(", ")}
Concurrents: ${competitors.map((c) => c.name).join(", ")}
Format: markdown ou JSON selon le type. Concis, answer-first, factuel.`;
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
  });
  return res.choices[0]?.message?.content ?? null;
}
