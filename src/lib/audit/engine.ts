import * as cheerio from "cheerio";

const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
] as const;

export type TechnicalChecks = {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  robotsTxt: {
    exists: boolean;
    allowsAiBots: Record<string, boolean>;
    blocksAll: boolean;
  };
  llmsTxt: { exists: boolean };
  sitemap: { exists: boolean; url?: string };
  schema: {
    hasFaqPage: boolean;
    hasSoftwareApplication: boolean;
    hasProduct: boolean;
    hasOrganization: boolean;
  };
  meta: {
    title?: string;
    description?: string;
    hasVisibleDate: boolean;
  };
  structure: {
    hasFaqSection: boolean;
    hasComparisonHints: boolean;
    hasPricingHints: boolean;
  };
  crawledPages: number;
};

function parseRobotsForBots(content: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const bot of AI_BOTS) {
    result[bot] = true;
  }
  const lines = content.split("\n");
  let currentAgent = "*";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim().toLowerCase();
    if (key.toLowerCase() === "user-agent") {
      currentAgent = value;
    }
    if (key.toLowerCase() === "disallow" && value === "/") {
      if (currentAgent === "*") {
        for (const bot of AI_BOTS) result[bot] = false;
      } else if (AI_BOTS.includes(currentAgent as (typeof AI_BOTS)[number])) {
        result[currentAgent] = false;
      }
    }
  }
  return result;
}

function detectSchemaTypes(html: string) {
  const types = new Set<string>();
  const regex = /"@type"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    types.add(m[1]);
  }
  return {
    hasFaqPage: types.has("FAQPage"),
    hasSoftwareApplication: types.has("SoftwareApplication"),
    hasProduct: types.has("Product"),
    hasOrganization: types.has("Organization"),
  };
}

function detectStructure($: cheerio.CheerioAPI) {
  const text = $("body").text().toLowerCase();
  const headings = $("h1,h2,h3")
    .map((_, el) => $(el).text().toLowerCase())
    .get()
    .join(" ");
  return {
    hasFaqSection: /faq|questions fréquentes|frequently asked/.test(headings),
    hasComparisonHints: /vs|comparatif|alternative|best /.test(text + headings),
    hasPricingHints: /pricing|tarif|prix|plans/.test(text + headings),
  };
}

async function fetchSafe(url: string) {
  const start = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "AISEO-AuditBot/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  return {
    statusCode: res.status,
    responseTimeMs: Date.now() - start,
    html,
  };
}

function originOf(url: string) {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

function mergeSchema(
  a: TechnicalChecks["schema"],
  b: TechnicalChecks["schema"],
): TechnicalChecks["schema"] {
  return {
    hasFaqPage: a.hasFaqPage || b.hasFaqPage,
    hasSoftwareApplication: a.hasSoftwareApplication || b.hasSoftwareApplication,
    hasProduct: a.hasProduct || b.hasProduct,
    hasOrganization: a.hasOrganization || b.hasOrganization,
  };
}

function mergeStructure(
  a: TechnicalChecks["structure"],
  b: TechnicalChecks["structure"],
): TechnicalChecks["structure"] {
  return {
    hasFaqSection: a.hasFaqSection || b.hasFaqSection,
    hasComparisonHints: a.hasComparisonHints || b.hasComparisonHints,
    hasPricingHints: a.hasPricingHints || b.hasPricingHints,
  };
}

export async function runTechnicalAudit(
  siteUrl: string,
  keyPageUrls: string[] = [],
): Promise<TechnicalChecks> {
  const origin = originOf(siteUrl);
  const homepage = await fetchSafe(siteUrl);
  const $ = cheerio.load(homepage.html);

  let robotsContent = "";
  let robotsExists = false;
  try {
    const robots = await fetchSafe(`${origin}/robots.txt`);
    robotsExists = robots.statusCode === 200;
    robotsContent = robots.html;
  } catch {
    robotsExists = false;
  }

  let llmsExists = false;
  try {
    const llms = await fetchSafe(`${origin}/llms.txt`);
    llmsExists = llms.statusCode === 200 && !llms.html.includes("<html");
  } catch {
    llmsExists = false;
  }

  let sitemapExists = false;
  let sitemapUrl: string | undefined;
  try {
    const sm = await fetchSafe(`${origin}/sitemap.xml`);
    sitemapExists = sm.statusCode === 200 && sm.html.includes("<urlset");
    if (sitemapExists) sitemapUrl = `${origin}/sitemap.xml`;
  } catch {
    sitemapExists = false;
  }

  const allowsAiBots = robotsExists
    ? parseRobotsForBots(robotsContent)
    : Object.fromEntries(AI_BOTS.map((b) => [b, true]));

  const bodyText = $("body").text();
  const hasVisibleDate =
    /\b(20\d{2}|mis à jour|updated|dernière mise à jour)\b/i.test(bodyText);

  // Crawl des pages clés du profil (pricing, docs, blog…) sur le même domaine,
  // pour que FAQ / comparatif / pricing ne soient pas jugés sur la homepage seule.
  let schema = detectSchemaTypes(homepage.html);
  let structure = detectStructure($);
  let crawledPages = 1;
  const extraUrls = [...new Set(keyPageUrls)]
    .filter((u) => {
      try {
        return originOf(u) === origin && u !== siteUrl;
      } catch {
        return false;
      }
    })
    .slice(0, 5);
  for (const pageUrl of extraUrls) {
    try {
      const page = await fetchSafe(pageUrl);
      if (page.statusCode !== 200) continue;
      const $page = cheerio.load(page.html);
      schema = mergeSchema(schema, detectSchemaTypes(page.html));
      structure = mergeStructure(structure, detectStructure($page));
      crawledPages++;
    } catch {
      // page clé injoignable — on garde le résultat homepage
    }
  }

  return {
    url: siteUrl,
    statusCode: homepage.statusCode,
    responseTimeMs: homepage.responseTimeMs,
    robotsTxt: {
      exists: robotsExists,
      allowsAiBots: allowsAiBots as Record<string, boolean>,
      blocksAll: Object.values(allowsAiBots).every((v) => !v),
    },
    llmsTxt: { exists: llmsExists },
    sitemap: { exists: sitemapExists, url: sitemapUrl },
    schema,
    meta: {
      title: $("title").first().text() || undefined,
      description: $('meta[name="description"]').attr("content"),
      hasVisibleDate,
    },
    structure,
    crawledPages,
  };
}

/** Contenu texte de la homepage, pour l'audit sémantique. */
export async function fetchPageText(siteUrl: string): Promise<string> {
  const page = await fetchSafe(siteUrl);
  const $ = cheerio.load(page.html);
  $("script,style,noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
}

export function scorePipeline(checks: TechnicalChecks) {
  let retrieval = 0;
  if (checks.statusCode === 200) retrieval += 25;
  if (checks.sitemap.exists) retrieval += 15;
  if (checks.robotsTxt.exists && !checks.robotsTxt.blocksAll) retrieval += 20;
  if (Object.values(checks.robotsTxt.allowsAiBots).filter(Boolean).length >= 3)
    retrieval += 20;
  if (checks.llmsTxt.exists) retrieval += 20;

  let scoring = 0;
  if (checks.schema.hasOrganization) scoring += 20;
  if (checks.schema.hasSoftwareApplication || checks.schema.hasProduct)
    scoring += 25;
  if (checks.meta.description) scoring += 15;
  if (checks.responseTimeMs < 3000) scoring += 20;
  if (checks.meta.hasVisibleDate) scoring += 20;

  let synthesis = 0;
  if (checks.schema.hasFaqPage) synthesis += 30;
  if (checks.structure.hasFaqSection) synthesis += 25;
  if (checks.structure.hasComparisonHints) synthesis += 25;
  if (checks.structure.hasPricingHints) synthesis += 20;

  return {
    retrieval: Math.min(100, retrieval),
    scoring: Math.min(100, scoring),
    synthesis: Math.min(100, synthesis),
  };
}

export function scorePlatforms(checks: TechnicalChecks) {
  const pipeline = scorePipeline(checks);
  const google = Math.round(
    pipeline.retrieval * 0.4 +
      pipeline.scoring * 0.3 +
      pipeline.synthesis * 0.3 +
      (checks.schema.hasFaqPage ? 10 : 0),
  );
  const chatgpt = Math.round(
    pipeline.retrieval * 0.35 +
      pipeline.scoring * 0.35 +
      (checks.meta.hasVisibleDate ? 15 : 0) +
      (checks.robotsTxt.allowsAiBots.GPTBot ? 10 : 0),
  );
  const perplexity = Math.round(
    pipeline.retrieval * 0.3 +
      pipeline.synthesis * 0.4 +
      (checks.robotsTxt.allowsAiBots.PerplexityBot ? 15 : 0),
  );
  return {
    google_aio: Math.min(100, google),
    chatgpt: Math.min(100, chatgpt),
    perplexity: Math.min(100, perplexity),
  };
}

export function overallScore(
  pipeline: ReturnType<typeof scorePipeline>,
): number {
  return Math.round(
    (pipeline.retrieval + pipeline.scoring + pipeline.synthesis) / 3,
  );
}
