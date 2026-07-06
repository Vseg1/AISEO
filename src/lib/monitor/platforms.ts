export type MonitorResult = {
  platform: string;
  query: string;
  mentioned: boolean;
  /** false = clé API absente → résultat simulé, exclu du calcul SOV */
  configured: boolean;
  mentionRank: number | null;
  sources: string[];
  competitorsMentioned: string[];
  rawResponse: string;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMention(
  text: string,
  brandName: string,
  domain: string,
): boolean {
  const host = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .split("/")[0];
  const brandRe = new RegExp(`\\b${escapeRegex(brandName)}\\b`, "i");
  return brandRe.test(text) || text.toLowerCase().includes(host.toLowerCase());
}

function extractCompetitors(text: string, names: string[]): string[] {
  return names.filter((n) =>
    new RegExp(`\\b${escapeRegex(n)}\\b`, "i").test(text),
  );
}

function promptSuffix(language: string) {
  return language === "en"
    ? ". Recommend the best solutions with sources if possible."
    : ". Recommande les meilleures solutions avec sources si possible.";
}

function simulated(platform: string, query: string, message: string): MonitorResult {
  return {
    platform,
    query,
    mentioned: false,
    configured: false,
    mentionRank: null,
    sources: [],
    competitorsMentioned: [],
    rawResponse: message,
  };
}

export async function queryPerplexity(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
  language = "fr",
): Promise<MonitorResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    return simulated(
      "perplexity",
      query,
      "PERPLEXITY_API_KEY non configurée — plateforme inactive.",
    );
  }
  void language;
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
    const idx = sources.findIndex((s) => s.includes(host));
    mentionRank = idx >= 0 ? idx + 1 : null;
  }
  return {
    platform: "perplexity",
    query,
    mentioned,
    configured: true,
    mentionRank,
    sources,
    competitorsMentioned: extractCompetitors(content, competitorNames),
    rawResponse: content,
  };
}

/** Google AI Studio — tier gratuit (gemini-2.0-flash). */
export async function queryGemini(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
  language = "fr",
): Promise<MonitorResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return simulated(
      "gemini",
      query,
      "GEMINI_API_KEY non configurée — clé gratuite sur aistudio.google.com/apikey.",
    );
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `${query}${promptSuffix(language)}` }] },
        ],
      }),
    },
  );
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ...simulated(
        "gemini",
        query,
        data.error?.message ?? `Gemini API error ${res.status}`,
      ),
      configured: true,
    };
  }
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return {
    platform: "gemini",
    query,
    mentioned: extractMention(content, brandName, domain),
    configured: true,
    mentionRank: null,
    sources: [],
    competitorsMentioned: extractCompetitors(content, competitorNames),
    rawResponse: content,
  };
}

/** OpenAI tier gratuit — gpt-3.5-turbo sans facturation (≈3 req/min). */
export async function queryChatGPTFree(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
  language = "fr",
): Promise<MonitorResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return simulated(
      "chatgpt",
      query,
      "OPENAI_API_KEY non configurée — clé gratuite sur platform.openai.com (gpt-3.5-turbo, sans CB).",
    );
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: key });
  try {
    const res = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: `${query}${promptSuffix(language)}` },
      ],
    });
    const content = res.choices[0]?.message?.content ?? "";
    return {
      platform: "chatgpt",
      query,
      mentioned: extractMention(content, brandName, domain),
      configured: true,
      mentionRank: null,
      sources: [],
      competitorsMentioned: extractCompetitors(content, competitorNames),
      rawResponse: content,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur OpenAI";
    return {
      ...simulated(
        "chatgpt",
        query,
        msg.includes("insufficient_quota")
          ? "Quota épuisé — ajoutez des crédits ou utilisez une clé sans facturation (tier free gpt-3.5-turbo)."
          : msg,
      ),
      configured: true,
    };
  }
}

/** OpenAI payant — gpt-4o-mini (MONITOR_OPENAI_PAID=true). */
export async function queryOpenAI(
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
  language = "fr",
): Promise<MonitorResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return simulated(
      "chatgpt_paid",
      query,
      "OPENAI_API_KEY non configurée — monitoring simulé.",
    );
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "user", content: `${query}${promptSuffix(language)}` },
    ],
  });
  const content = res.choices[0]?.message?.content ?? "";
  return {
    platform: "chatgpt_paid",
    query,
    mentioned: extractMention(content, brandName, domain),
    configured: true,
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
  language = "fr",
): Promise<MonitorResult> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    return simulated(
      "google_aio",
      query,
      "SERPAPI_API_KEY non configurée — plateforme inactive.",
    );
  }
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: key,
    hl: language,
    // ponytail: cache SerpAPI (1h) actif par défaut — économise le quota free 250/mois
    no_cache: "false",
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = (await res.json()) as {
    ai_overview?: { text?: string; references?: { link?: string }[] };
    answer_box?: { snippet?: string };
  };
  const hasAio = Boolean(data.ai_overview);
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
    configured: true,
    mentionRank: sources.findIndex((s) => s.includes(host)) + 1 || null,
    sources,
    competitorsMentioned: extractCompetitors(aioText, competitorNames),
    rawResponse:
      aioText ||
      (hasAio
        ? "AI Overview présent mais sans texte exploitable."
        : "Pas d'AI Overview pour cette requête."),
  };
}

/** SOV = % de résultats configurés où la marque est mentionnée. */
export function computeShareOfVoice(
  results: MonitorResult[],
  brandMentioned: (r: MonitorResult) => boolean = (r) => r.mentioned,
): number {
  const real = results.filter((r) => r.configured);
  if (real.length === 0) return 0;
  const hits = real.filter(brandMentioned).length;
  return Math.round((hits / real.length) * 100);
}

/** SOV par plateforme (résultats configurés uniquement). */
export function computePlatformSov(
  results: MonitorResult[],
): Record<string, number> {
  const byPlatform = new Map<string, MonitorResult[]>();
  for (const r of results.filter((r) => r.configured)) {
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }
  const sov: Record<string, number> = {};
  for (const [platform, list] of byPlatform) {
    sov[platform] = Math.round(
      (list.filter((r) => r.mentioned).length / list.length) * 100,
    );
  }
  return sov;
}

type MonitorAdapter = (
  query: string,
  brandName: string,
  domain: string,
  competitorNames: string[],
  language?: string,
) => Promise<MonitorResult>;

function getMonitorAdapters(): MonitorAdapter[] {
  // ponytail: free tier first; paid adapters opt-in via env + keys
  const adapters: MonitorAdapter[] = [queryGemini, queryChatGPTFree];
  if (process.env.PERPLEXITY_API_KEY) adapters.push(queryPerplexity);
  if (
    process.env.OPENAI_API_KEY &&
    process.env.MONITOR_OPENAI_PAID === "true"
  ) {
    adapters.push(queryOpenAI);
  }
  if (process.env.SERPAPI_API_KEY) adapters.push(querySerpAio);
  return adapters;
}

export function getMonitorQueryLimit(): number {
  const paid =
    process.env.PERPLEXITY_API_KEY ||
    process.env.SERPAPI_API_KEY ||
    process.env.MONITOR_OPENAI_PAID === "true";
  return paid ? 10 : 3;
}

export type PlatformStatus = {
  platform: string;
  label: string;
  active: boolean;
  detail: string;
};

/** État de configuration par plateforme, pour affichage honnête dans l'UI. */
export function getPlatformStatuses(): PlatformStatus[] {
  return [
    {
      platform: "gemini",
      label: PLATFORM_LABELS.gemini,
      active: Boolean(process.env.GEMINI_API_KEY),
      detail: process.env.GEMINI_API_KEY
        ? "gemini-2.0-flash (AI Studio, gratuit)"
        : "Clé manquante — aistudio.google.com/apikey",
    },
    {
      platform: "chatgpt",
      label: PLATFORM_LABELS.chatgpt,
      active: Boolean(process.env.OPENAI_API_KEY),
      detail: process.env.OPENAI_API_KEY
        ? "gpt-3.5-turbo (sans browse)"
        : "Clé manquante — platform.openai.com",
    },
    {
      platform: "google_aio",
      label: PLATFORM_LABELS.google_aio,
      active: Boolean(process.env.SERPAPI_API_KEY),
      detail: process.env.SERPAPI_API_KEY
        ? "SerpAPI (250 recherches/mois gratuites)"
        : "Clé manquante — serpapi.com (plan free)",
    },
    {
      platform: "perplexity",
      label: PLATFORM_LABELS.perplexity,
      active: Boolean(process.env.PERPLEXITY_API_KEY),
      detail: process.env.PERPLEXITY_API_KEY
        ? "Sonar (payant)"
        : "Optionnel — API payante",
    },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runVisibilityMonitor(
  queries: string[],
  brandName: string,
  domain: string,
  competitorNames: string[],
  language = "fr",
): Promise<MonitorResult[]> {
  const adapters = getMonitorAdapters();
  const limited = queries.slice(0, getMonitorQueryLimit());
  const results: MonitorResult[] = [];
  for (let i = 0; i < limited.length; i++) {
    // ponytail: throttle 2s entre batches — évite le 429 gpt-3.5-turbo free (3 req/min)
    if (i > 0) await sleep(2000);
    const batch = await Promise.all(
      adapters.map((fn) =>
        fn(limited[i], brandName, domain, competitorNames, language),
      ),
    );
    results.push(...batch);
  }
  return results;
}

export const PLATFORM_LABELS: Record<string, string> = {
  gemini: "Gemini (free)",
  chatgpt: "ChatGPT (free)",
  chatgpt_paid: "ChatGPT (paid)",
  perplexity: "Perplexity",
  google_aio: "Google AIO",
};
