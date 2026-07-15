# Migration GitHub Pages → Cloudflare Pages (P0 pré-lancement)

## Le problème

`https://planmaville.fr/ville/:slug` pour une commune **non prérendue**
(sous le seuil `prerenderMinPopulation` de `scoring.config.json`, ~32 000 des
35 000 communes) renvoie un **statut HTTP 404** sur GitHub Pages : son
fallback SPA (`404.html`) sert bien le shell client Angular, mais avec le
code HTTP 404. Les crawlers de preview (Facebook, WhatsApp…) et les moteurs
de recherche respectent le code HTTP, pas le rendu JS — la fiche est donc
invisible/mal partagée alors même que l'utilisateur la voit s'afficher
normalement dans son navigateur.

## Ce qui a été fait côté code (déjà en place sur cette branche)

1. **`public/_redirects`** — fallback SPA générique en **200** (au lieu de
   404) pour toute route gérée côté client, servi par Cloudflare Pages.
2. **`public/_routes.json`** — restreint les Pages Functions à `/ville/*` :
   toutes les autres routes (accueil, régions, départements, classement…,
   intégralement prérendues) continuent de passer directement par les assets
   statiques, sans invocation de Function ni surcoût.
3. **`functions/ville/[slug].js`** (+ logique pure testée dans
   `functions/_lib/commune-meta.mjs`, `npm run test:functions`) — la vraie
   correction, au-delà du simple code HTTP : pour une commune **non**
   prérendue, cette Cloudflare Pages Function sert le même shell CSR que
   l'ancien fallback GitHub Pages, mais avec les balises `<title>`,
   `<meta description>`, OpenGraph, Twitter Card et canonique **de la
   commune demandée** injectées à la volée (même formulation que
   `MetaService`/`commune.ts` côté client, pour rester cohérent une fois
   l'app hydratée). Un slug inconnu reçoit un `noindex` (soft-404), une
   commune déjà prérendue est servie telle quelle (aucune régression : la
   Function vérifie d'abord l'asset statique via le binding `ASSETS` et le
   retourne sans modification s'il existe).
4. **`wrangler.toml`** — nom de projet Cloudflare Pages
   (`ma-ville-notes`) + dossier de sortie du build.
5. **`.github/workflows/deploy-cloudflare-pages.yml`** — build identique à
   `deploy.yml` (data:build + secrets + `ng build`), déploie ensuite via
   `wrangler pages deploy`. **Tourne en parallèle de `deploy.yml`** (GitHub
   Pages) sans aucun risque tant que le DNS de `planmaville.fr` pointe
   encore vers GitHub Pages : il publie sur l'URL de preview
   `*.pages.dev` du projet, jamais sur le domaine live. Si les secrets
   Cloudflare (ci-dessous) ne sont pas configurés, le step de déploiement est
   sauté proprement (`::warning::`), sans faire échouer le workflow.
6. **Option B (filet de sécurité pendant la bascule)** —
   `src/app/app.routes.server.ts` prérend désormais aussi, quel que soit le
   seuil de population : le top 50 / flop 50 national (`classement.json`,
   pages les plus à risque de partage viral) et l'intégralité des communes
   des départements ciblés par la campagne en cours (`DEPARTEMENTS_CAMPAGNE`
   = 75, 93, 94 — à étendre au fur et à mesure des départements visés par la
   presse). Ces pages ont un vrai HTML statique (meilleur signal SEO que le
   fallback dynamique), la Function reste le filet de sécurité pour le reste.

## Ce qu'il reste à faire (actions côté compte Cloudflare — hors de portée d'un agent sans accès à ce compte)

### 1. Créer le projet Cloudflare Pages

Dashboard Cloudflare → **Workers & Pages** → **Create application** → **Pages**
→ **Upload assets** (ou connecter le dépôt Git directement, voir note
ci-dessous) → nom du projet **`ma-ville-notes`** (doit correspondre à
`wrangler.toml` et au workflow).

Deux façons de déployer, au choix :

- **Via ce workflow GitHub Actions** (`deploy-cloudflare-pages.yml`,
  `wrangler pages deploy`) — gère les secrets Supabase et le pipeline de
  données exactement comme `deploy.yml` existant. **Recommandé**, pour
  garder un seul pipeline de build/secrets à maintenir.
- **Via l'intégration Git native de Cloudflare Pages** — plus simple à
  activer, mais duplique la config des secrets (Cloudflare Environment
  Variables plutôt que GitHub Secrets) et ne lance pas `data:build` sans un
  build command custom. Si ce choix est fait, **désactiver/supprimer**
  `deploy-cloudflare-pages.yml` pour éviter un double déploiement.

### 2. Secrets GitHub (si le workflow ci-dessus est utilisé)

Settings → Secrets and variables → Actions → New repository secret :

- `CLOUDFLARE_API_TOKEN` — créer un token API Cloudflare avec la permission
  **"Cloudflare Pages: Edit"** (My Profile → API Tokens → Create Token →
  template "Edit Cloudflare Workers" ou permission custom Pages:Edit).
- `CLOUDFLARE_ACCOUNT_ID` — visible dans le dashboard Cloudflare (barre
  latérale droite de n'importe quelle page du compte, ou
  `wrangler whoami`).

### 3. Vérifier le déploiement de preview

Une fois les secrets posés, `git push` sur `main` (ou `workflow_dispatch`)
déclenche `deploy-cloudflare-pages.yml`. Vérifier sur l'URL de preview
`https://ma-ville-notes.pages.dev` (ou équivalent) :

```bash
curl -I https://ma-ville-notes.pages.dev/ville/samatan-32410   # doit renvoyer 200
curl -s https://ma-ville-notes.pages.dev/ville/samatan-32410 | grep -o '<title>[^<]*</title>'
```

Puis [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
sur cette URL de preview pour confirmer la preview OG.

### 4. Bascule DNS (planmaville.fr)

**Seulement après vérification de l'étape 3.** Dans Cloudflare DNS
(déjà chez Cloudflare d'après le contexte du projet) :

- Remplacer l'enregistrement CNAME actuel (vers `zikaoinfo.github.io`) par
  un enregistrement pointant vers le projet Pages (Cloudflare propose un
  bouton "Set up a custom domain" directement depuis le projet Pages, qui
  crée l'enregistrement DNS automatiquement en mode proxied — c'est la
  méthode recommandée plutôt qu'un CNAME manuel).
- Attendre la propagation (généralement immédiate chez Cloudflare, DNS déjà
  hébergé là).

### 5. Nettoyage post-bascule

Une fois le trafic confirmé sur Cloudflare Pages (`curl -I
https://planmaville.fr/ville/samatan-32410` → 200, et plus aucune requête
dans les logs GitHub Pages) :

- Supprimer/désactiver `.github/workflows/deploy.yml` (et
  `data-refresh.yml`, qui redéploie sur GitHub Pages) — ou les adapter pour
  pointer vers Cloudflare Pages si un seul pipeline est souhaité.
- Supprimer `public/CNAME` (spécifique à GitHub Pages) et désactiver GitHub
  Pages dans Settings → Pages du dépôt.
- Retirer ce document une fois la migration stabilisée, ou le garder comme
  historique.

## Critères de validation (rappel)

- `curl -I https://planmaville.fr/ville/samatan-32410` → **200**.
- Facebook Sharing Debugger → preview correcte (titre/description de LA
  commune, pas génériques) pour une commune non prérendue.
- Aucune régression de statut HTTP sur les pages déjà prérendues (`/`,
  `/departement/94`, `/ville/rosny-sous-bois-93064`…) — vérifié par le test
  `functions/test/commune-meta.spec.mjs` (logique pure) et par la Function
  elle-même (asset statique servi tel quel avant tout calcul de meta).

## Limite connue

`functions/ville/[slug].js` recalcule les meta en lisant `data/index.json`
puis `data/dep/{code}.json` via le binding `ASSETS` (edge-local, pas de
requête réseau externe) à chaque requête sur une commune non prérendue. Pour
le volume de trafic du lancement, c'est largement suffisant ; si le volume
augmente fortement, envisager un cache en mémoire d'isolate (variable de
module) ou l'API Cache de Cloudflare pour éviter de re-parser `index.json`
à chaque requête.
