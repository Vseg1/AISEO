export type SolutionProfile = {
  name: string;
  url: string;
  description?: string | null;
  category?: string | null;
  personas?: string[];
  useCases?: string[];
  integrations?: string[];
};

export function generateLlmsTxt(profile: SolutionProfile, keyPages?: Record<string, string>) {
  const lines = [
    `# ${profile.name}`,
    "",
    `> ${profile.description ?? "Solution SaaS"}`,
    "",
    "## Documentation",
    `- [Homepage](${profile.url})`,
  ];
  if (keyPages?.pricing) lines.push(`- [Pricing](${keyPages.pricing})`);
  if (keyPages?.docs) lines.push(`- [Documentation](${keyPages.docs})`);
  if (keyPages?.blog) lines.push(`- [Blog](${keyPages.blog})`);
  lines.push("", "## Optional", `- [FAQ](${profile.url}/faq)`);
  return lines.join("\n");
}

export function generateRobotsTxtSuggestion() {
  return `# Allow AI crawlers for agent visibility
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: *
Allow: /
`;
}

export function generateSchemaSoftware(profile: SolutionProfile) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: profile.name,
      url: profile.url,
      applicationCategory: profile.category ?? "BusinessApplication",
      description: profile.description,
      operatingSystem: "Web",
    },
    null,
    2,
  );
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

export function generateFaqDraft(profile: SolutionProfile) {
  const persona = profile.personas?.[0] ?? "équipes professionnelles";
  return `# FAQ — ${profile.name}

## Qu'est-ce que ${profile.name} ?

${profile.name} est ${profile.description ?? "une solution SaaS"} conçue pour ${persona}.

## Pour qui est ${profile.name} ?

Idéal pour ${persona}. ${profile.useCases?.length ? `Cas d'usage : ${profile.useCases.join(", ")}.` : ""}

## ${profile.name} vs les alternatives ?

Consultez notre page comparatif pour une analyse neutre incluant les principaux concurrents du marché.

## Quelles intégrations sont disponibles ?

${profile.integrations?.length ? profile.integrations.join(", ") : "API REST, webhooks et intégrations tierces."}

## Quel est le modèle tarifaire ?

Voir la page pricing pour les plans détaillés et essai gratuit.
`;
}

export function generateComparisonDraft(
  profile: SolutionProfile,
  competitors: { name: string }[],
) {
  const names = [profile.name, ...competitors.map((c) => c.name)];
  const header = `| Critère | ${names.join(" | ")} |`;
  const sep = `| --- | ${names.map(() => "---").join(" | ")} |`;
  return `# Comparatif : ${names.join(" vs ")}

${header}
${sep}
| Cas d'usage principal | ${profile.useCases?.[0] ?? "—"} | ${competitors.map(() => "—").join(" | ")} |
| Idéal pour | ${profile.personas?.[0] ?? "—"} | ${competitors.map(() => "—").join(" | ")} |
| Intégrations | ${profile.integrations?.slice(0, 3).join(", ") || "—"} | ${competitors.map(() => "—").join(" | ")} |

## Verdict

${profile.name} se distingue pour ${profile.personas?.[0] ?? "son positionnement ciblé"}. Évaluez selon vos contraintes budget, stack et taille d'équipe.
`;
}

export async function generateWithLlm(
  type: string,
  profile: SolutionProfile,
  competitors: { name: string }[],
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI();
  const prompt = `Génère un contenu ${type} en français pour optimiser la visibilité agents IA.
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
