import { fetchPageText } from "./engine";

/**
 * Audit sémantique léger : 1 appel Gemini (free tier) évalue si la homepage
 * répond aux requêtes cibles. Retourne un score 0–100 par requête.
 * Retourne {} si GEMINI_API_KEY absente ou en cas d'erreur (audit optionnel).
 */
export async function runSemanticAudit(
  siteUrl: string,
  queries: string[],
): Promise<Record<string, number>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || queries.length === 0) return {};

  let pageText: string;
  try {
    pageText = await fetchPageText(siteUrl);
  } catch {
    return {};
  }
  if (!pageText) return {};

  const limited = queries.slice(0, 5);
  const prompt = `Tu évalues la pertinence d'une page web pour des requêtes utilisateur adressées à un agent IA.

Contenu de la page (extrait) :
"""
${pageText}
"""

Pour chaque requête ci-dessous, donne un score 0-100 : la page répond-elle directement à cette intention (réponse claire, answer-first, vocabulaire aligné) ?

Requêtes :
${limited.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Réponds UNIQUEMENT avec un JSON de la forme {"1": score, "2": score, ...} sans autre texte.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[^}]*\}/);
    if (!jsonMatch) return {};
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>;
    const scores: Record<string, number> = {};
    limited.forEach((q, i) => {
      const v = Number(parsed[String(i + 1)]);
      if (Number.isFinite(v)) scores[q] = Math.max(0, Math.min(100, Math.round(v)));
    });
    return scores;
  } catch {
    return {};
  }
}
