# Pilote dogfooding — visibilité agent IA (budget gratuit)

Protocole 4 semaines pour mesurer et améliorer la part de voix (SOV) de votre
propre SaaS dans les réponses des agents IA, sans budget API.

## 1. Checklist environnement

Variables à configurer (Vercel + `.env.local`) :

```
DATABASE_URL            # Neon Postgres
AUTH_SECRET             # openssl rand -base64 32
CRON_SECRET             # protège /api/cron/monitor
GEMINI_API_KEY          # gratuit — https://aistudio.google.com/apikey
OPENAI_API_KEY          # gratuit sans CB — https://platform.openai.com (gpt-3.5-turbo)
SERPAPI_API_KEY         # gratuit 250 recherches/mois — https://serpapi.com
AUTH_DEV_LOGIN=true     # dogfooding uniquement ; retirer avant tout client externe
```

Plateformes actives selon les clés (visible sur la page Monitoring) :

| Plateforme | Clé | Quota gratuit | Fiabilité |
|-----------|-----|---------------|-----------|
| Gemini (free) | `GEMINI_API_KEY` | ~1500 req/jour | Proxy Google, sans web temps réel |
| ChatGPT (free) | `OPENAI_API_KEY` | ~3 req/min | Sans browse — connaissance modèle |
| Google AIO | `SERPAPI_API_KEY` | 250 recherches/mois | **Seule mesure web réelle du pilote** |

En mode gratuit, **3 requêtes** sont suivies par run (10 avec une clé payante).
Budget SerpAPI : 3 requêtes × ~8 runs/mois ≈ 24 recherches — large marge.

## 2. Choisir vos 3 requêtes cibles

Une requête par intention, telle qu'un utilisateur la poserait à un agent :

1. **Intent commercial** — « meilleur [catégorie] pour [persona] [marché] »
2. **Comparatif** — « [votre produit] vs [concurrent principal] » ou « alternatives à [concurrent] »
3. **Problème** — « comment [problème que votre produit résout] »

Éditables à tout moment dans Paramètres (les 3 premières sont suivies).

## 3. Protocole 4 semaines

| Semaine | Action | Mesure |
|---------|--------|--------|
| S0 | Onboarding + audit auto + baseline monitoring | SOV₀ par plateforme (export CSV) |
| S1 | Publier `llms.txt` + `robots.txt` (assets générés) | Re-run à J+3, note « llms+robots publiés » |
| S2 | Publier FAQ + schema SoftwareApplication | Re-run à J+3, note « FAQ+schema publiés » |
| S3 | Publier page comparatif (draft enrichi, cellules complétées) | Re-run à J+3, note « comparatif publié » |
| S4 | Si SOV plat : ajuster 1 requête dans Paramètres | SOV₄ vs SOV₀ |

À chaque run manuel, renseignez le champ **note** — il apparaît dans
l'historique et permet de corréler publication → évolution SOV.

**Objectif** : +20 pts de SOV global **ou** apparition dans Google AI Overviews
(SerpAPI) sur au moins 1 requête.

## 4. Interpréter les résultats

- **SOV global** = % de (requête × plateforme configurée) où votre marque est
  mentionnée. Les plateformes sans clé sont exclues du calcul.
- **Gemini / ChatGPT free** répondent sur leur connaissance du modèle, pas sur
  le web du jour : vos changements de site n'ont **pas d'effet immédiat** sur
  ces plateformes (les modèles se réentraînent périodiquement). Elles mesurent
  votre notoriété de fond.
- **Google AIO (SerpAPI)** reflète le web réel — c'est là que vos publications
  (llms.txt, schema, FAQ) peuvent produire un effet en quelques semaines.
- « Pas d'AI Overview pour cette requête » ≠ « non mentionné » : Google ne
  génère pas d'AIO sur toutes les requêtes.
- L'**intent match** (page Audit) mesure si votre homepage répond directement
  aux requêtes cibles — visez ≥ 70/100 par requête.

## 5. Livrable final (fin S4)

1. Profil solution + 3 requêtes cibles
2. Exports CSV : baseline (S0) et dernier run (S4)
3. SOV₀ → SOV₄ global et par plateforme (graphique Monitoring)
4. Liste des assets publiés avec URLs
5. Recommandations : faites vs ignorées
6. Décision go/no-go pour ouvrir à 1 client externe — prérequis :
   - Auth production (Google OAuth ou Resend), retirer `AUTH_DEV_LOGIN`
   - Budget API minimal (~10–25 €/mois : SerpAPI Starter ou crédits OpenAI)
