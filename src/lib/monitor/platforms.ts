export type MonitorResult = {
  platform: string;
  query: string;
  mentioned: boolean;
  mentionRank: number | null;
  sources: string[];
  competitorsMentioned: string[];
  rawResponse: string;
};

function extractMention(
  text: string,
  brandName: string,
  domain: string,
): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes(brandName.toLowerCase()) ||
    lower.includes(domain.replace(/^https?:\/\//, "").replace(/\/$/, ""))
  );
}

function extractCompetitors(text: string, names: string[]): string[] {
  const lower = text.toLowerCase();
  return names.filter((n) => lower.includes(n.toLowerCase()));
}

export async function queryPerplexity(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
): Promise<MonitorResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return {
      platform: "perplexity",
      query,
      mentioned: false,
      mentionRank: null,
      sources: [],
      competitorsMentioned: [],
      rawResponse: "PERPLEXITY_API_KEY non configurée — monitoring simulé.",
    };
  }
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
    }),
  });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const sources = data.citations ?? [];
  const mentioned = extractMention(content, brandName, domain);
  let mentionRank: number | null = null;
  if (mentioned && sources.length) {
    const host = domain.replace(/^https?:\/\//, "").split("/")[0];
    mentionRank =
      sources.findIndex((s) => s.includes(host)) >= 0
        ? sources.findIndex((s) => s.includes(host)) + 1
        : null;
  }
  return {
    platform: "perplexity",
    query,
    mentioned,
    mentionRank,
    sources,
    competitorsMentioned: extractCompetitors(content, competitorNames),
    rawResponse: content,
  };
}

export async function queryOpenAI(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
): Promise<MonitorResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      platform: "chatgpt",
      query,
      mentioned: false,
      mentionRank: null,
      sources: [],
      competitorsMentioned: [],
      rawResponse: "OPENAI_API_KEY non configurée — monitoring simulé.",
    };
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `${query}. Recommande les meilleures solutions avec sources si possible.`,
      },
    ],
  });
  const content = res.choices[0]?.message?.content ?? "";
  return {
    platform: "chatgpt",
    query,
    mentioned: extractMention(content, brandName, domain),
    mentionRank: null,
    sources: [],
    competitorsMentioned: extractCompetitors(content, competitorNames),
    rawResponse: content,
  };
}

export async function querySerpAio(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
): Promise<MonitorResult> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    return {
      platform: "google_aio",
      query,
      mentioned: false,
      mentionRank: null,
      sources: [],
      competitorsMentioned: [],
      rawResponse: "SERPAPI_API_KEY non configurée — monitoring simulé.",
    };
  }
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: key,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = (await res.json()) as {
    ai_overview?: { text?: string; references?: { link?: string }[] };
    answer_box?: { snippet?: string };
  };
  const aioText = data.ai_overview?.text ?? data.answer_box?.snippet ?? "";
  const sources =
    data.ai_overview?.references?.map((r) => r.link ?? "").filter(Boolean) ??
    [];
  const host = domain.replace(/^https?:\/\//, "").split("/")[0];
  const mentioned =
    extractMention(aioText, brandName, domain) ||
    sources.some((s) => s.includes(host));
  return {
    platform: "google_aio",
    query,
    mentioned,
    mentionRank: sources.findIndex((s) => s.includes(host)) + 1 || null,
    sources,
    competitorsMentioned: extractCompetitors(aioText, competitorNames),
    rawResponse: aioText || "Pas d'AI Overview pour cette requête.",
  };
}

export function computeShareOfVoice(
  results: MonitorResult[],
  brandMentioned: (r: MonitorResult) => boolean,
): number {
  if (results.length === 0) return 0;
  const hits = results.filter(brandMentioned).length;
  return Math.round((hits / results.length) * 100);
}

export async function runVisibilityMonitor(
  queries: string[],
  brandName: string,
  domain: string,
  competitorNames: string[],
): Promise<MonitorResult[]> {
  const limited = queries.slice(0, 10);
  const results: MonitorResult[] = [];
  for (const query of limited) {
    const [p, o, s] = await Promise.all([
      queryPerplexity(query, brandName, domain, competitorNames),
      queryOpenAI(query, brandName, domain, competitorNames),
      querySerpAio(query, brandName, domain, competitorNames),
    ]);
    results.push(p, o, s);
  }
  return results;
}
