# Guide des champs — Onboarding AISEO

Ce document décrit **chaque champ** du wizard d’onboarding (4 étapes). Ces informations alimentent l’audit, les recommandations, la génération d’assets et le monitoring de visibilité agent.

**Convention** : les champs « un par ligne » acceptent plusieurs valeurs — **une entrée par ligne**.

---

## Étape 1 — Identité

Informations de base sur votre solution et son périmètre géographique.

### Nom de la solution
**Obligatoire**

Nom commercial ou marque tel qu’un utilisateur le mentionnerait.

| | |
|---|---|
| **Exemple** | `WedPlanner`, `Mon CRM Pro` |
| **Usage AISEO** | Détection des mentions dans le monitoring (ChatGPT, Perplexity, Google AIO) ; titres des assets générés (`llms.txt`, FAQ, comparatifs) |
| **Conseil** | Utilisez le nom exact affiché sur votre site, sans slogan |

### URL principale
**Obligatoire**

Adresse web publique de votre produit (homepage).

| | |
|---|---|
| **Exemple** | `https://mon-saas.com` |
| **Usage AISEO** | Point de départ du crawl technique (robots.txt, llms.txt, schema.org, sitemap) ; extraction du domaine pour les citations agent |
| **Conseil** | URL avec `https://`, sans slash final de préférence |

### Type
**Obligatoire** — liste déroulante

Nature de votre solution :

| Valeur | Quand la choisir |
|--------|------------------|
| **Site web** | Vitrine, blog, portfolio — pas d’application connectée |
| **Webapp** | Application web accessible via navigateur |
| **SaaS** | Produit logiciel par abonnement (défaut) |

**Usage AISEO** : contexte pour le schema `SoftwareApplication` et le ton des contenus générés.

### Langue
**Optionnel** (défaut : `fr`)

Langue principale du contenu et du marché cible.

| | |
|---|---|
| **Exemple** | `fr`, `en` |
| **Usage AISEO** | Requêtes de monitoring formulées dans la bonne langue ; contenus générés en français ou anglais |
| **Conseil** | Code ISO simple : `fr`, `en`, `de`… |

### Marchés (un par ligne)
**Optionnel**

Zones géographiques ou marchés visés.

| | |
|---|---|
| **Exemple** | `France` / `Europe` / `Québec` |
| **Usage AISEO** | Affinement sémantique (« CRM PME France » vs global) ; comparatifs orientés marché local |
| **Conseil** | Une zone par ligne, du plus spécifique au plus large |

---

## Étape 2 — Positionnement

Comment vous décrivez votre produit, pour qui il est fait et ce qu’il fait.

### Description
**Obligatoire**

2–3 phrases expliquant **ce que fait** votre solution et **quelle valeur** elle apporte.

| | |
|---|---|
| **Exemple** | *« Outil qui permet de gérer tout le cycle de vie du mariage, de la planification au jour J, pour organiser efficacement budget, prestataires et invités. »* |
| **Usage AISEO** | Génération FAQ, `llms.txt`, JSON-LD ; clarté de positionnement pour les agents IA |
| **Conseil** | Factuel, sans superlatifs marketing (« le meilleur »). Répondez à : *Qu’est-ce que c’est ? Pour quel problème ?* |

### Catégorie
**Optionnel**

Segment produit ou famille logicielle en quelques mots.

| | |
|---|---|
| **Exemple** | `CRM`, `Gestion d'événements`, `Analytics`, `Outil mariage` |
| **Usage AISEO** | Champ `applicationCategory` du schema SoftwareApplication ; pages comparatives |
| **Conseil** | Utilisez la catégorie qu’un utilisateur taperait dans une recherche |

### Personas cibles (un par ligne)
**Optionnel**

Profils types de vos utilisateurs idéaux — **pour qui** est le produit.

| | |
|---|---|
| **Exemple** | `Organisateurs de mariage indépendants` / `Agences événementielles 5–20 personnes` / `Couples en préparation de mariage` |
| **Usage AISEO** | Sections « Pour qui » dans FAQ et comparatifs ; adéquation intent ↔ persona dans les recommandations agent |
| **Conseil** | Soyez précis : taille d’équipe, secteur, maturité. Évitez « tout le monde » |

### Cas d'usage (un par ligne)
**Optionnel**

Situations concrètes ou problèmes que le produit résout.

| | |
|---|---|
| **Exemple** | `Suivi du budget mariage` / `Gestion des prestataires` / `Planning J-365 à J-0` / `Liste des invités et RSVP` |
| **Usage AISEO** | FAQ, comparatifs, matching avec les requêtes cibles (étape 4) |
| **Conseil** | Formulez en verbe d’action : *Gérer…*, *Automatiser…*, *Suivre…* |

### Intégrations (un par ligne)
**Optionnel**

Outils, API ou services avec lesquels votre produit se connecte.

| | |
|---|---|
| **Exemple** | `Slack` / `Google Calendar` / `Stripe` / `Zapier` |
| **Usage AISEO** | Tableaux comparatifs ; pertinence quand un agent cherche une solution compatible avec un stack existant |
| **Conseil** | Nommez les intégrations comme vos utilisateurs les cherchent |

---

## Étape 3 — Concurrence

Solutions alternatives que vos prospects comparent à la vôtre.

### Concurrents — noms (un par ligne)
**Optionnel** (recommandé : 2–5)

Noms des produits ou marques concurrentes directes.

| | |
|---|---|
| **Exemple** | `Zola` / `Hitched` / `Mariage.net` |
| **Usage AISEO** | Monitoring : détection des mentions concurrentes dans les réponses agent ; brouillon de page « X vs Y vs Z » |
| **Conseil** | Concurrents réellement cités dans votre secteur, pas des géants génériques sauf si pertinents |

### URLs concurrents (optionnel, même ordre)
**Optionnel**

URLs des sites concurrents, **dans le même ordre** que la liste des noms.

| | |
|---|---|
| **Exemple** | Ligne 1 : `https://concurrent-a.com` ↔ nom ligne 1 |
| **Usage AISEO** | Référence pour comparatifs ; analyse indirecte du paysage |
| **Conseil** | Même nombre de lignes que les noms, ou laissez vide pour un concurrent sans URL |

---

## Étape 4 — Visibilité

Requêtes à suivre et pages clés de votre site pour l’optimisation agent.

### Requêtes cibles (5–20, une par ligne)
**Obligatoire**

Formulations que vos prospects taperaient dans ChatGPT, Perplexity ou Google pour trouver une solution comme la vôtre.

| | |
|---|---|
| **Exemple** | `meilleur outil organisation mariage` / `alternative à Zola` / `logiciel wedding planner PME France` / `comment organiser son mariage facilement` |
| **Usage AISEO** | **Monitoring** : simulation sur Perplexity, ChatGPT, Google AIO ; calcul de la part de voix vs concurrents |
| **Conseil** | Variez les intents : comparatif, recommandation, alternative, question ouverte. Formulez comme un vrai utilisateur, pas en mot-clé SEO |

### URL page pricing
**Optionnel**

Lien vers votre page tarifs / plans.

| | |
|---|---|
| **Exemple** | `https://mon-saas.com/pricing` |
| **Usage AISEO** | Inclus dans `llms.txt` ; signal pour agents qui comparent les prix |
| **Conseil** | Page indexable publiquement (pas derrière login) |

### URL documentation
**Optionnel**

Lien vers docs, aide ou base de connaissances.

| | |
|---|---|
| **Exemple** | `https://mon-saas.com/docs` |
| **Usage AISEO** | `llms.txt` ; agents techniques (Claude, dev) privilégient la doc structurée |
| **Conseil** | URL stable, de préférence avec contenu technique ou FAQ |

### URL blog
**Optionnel**

Lien vers blog, ressources ou actualités.

| | |
|---|---|
| **Exemple** | `https://mon-saas.com/blog` |
| **Usage AISEO** | `llms.txt` ; fraîcheur de contenu (important pour ChatGPT) |
| **Conseil** | Utile si vous publiez comparatifs, guides ou études de cas |

---

## Récapitulatif — champs obligatoires

| Étape | Champs obligatoires |
|-------|---------------------|
| 1 — Identité | Nom, URL, Type |
| 2 — Positionnement | Description |
| 3 — Concurrence | *(aucun)* |
| 4 — Visibilité | Requêtes cibles |

---

## Après la soumission

Le bouton **« Créer et analyser »** (étape 4) enregistre le profil solution et redirige vers le dashboard. Vous pourrez ensuite :

1. **Lancer l’audit** technique du site
2. Consulter les **recommandations** par Tier (AIO, ChatGPT, Perplexity)
3. **Générer des assets** (llms.txt, schema.org, FAQ, comparatif)
4. **Monitorer** vos requêtes cibles

---

## Exemple complet — outil mariage

**Étape 1**
- Nom : `WedCycle`
- URL : `https://wedcycle.app`
- Type : SaaS
- Langue : `fr`
- Marchés : `France`, `Belgique`, `Suisse`

**Étape 2**
- Description : *« Plateforme SaaS pour gérer l’organisation d’un mariage : budget, prestataires, planning et invités. »*
- Catégorie : `Gestion d'événements`
- Personas : `Wedding planners indépendants`, `Couples organisant leur mariage`
- Cas d’usage : `Suivi budget`, `Gestion prestataires`, `RSVP invités`
- Intégrations : `Google Calendar`, `Stripe`

**Étape 3**
- Concurrents : `Zola`, `Hitched`
- URLs : `https://www.zola.com`, *(vide)*

**Étape 4**
- Requêtes : `meilleur logiciel organisation mariage`, `alternative Zola wedding`, `outil wedding planner France`
- Pricing : `https://wedcycle.app/tarifs`
- Docs : `https://wedcycle.app/aide`
- Blog : `https://wedcycle.app/blog`
