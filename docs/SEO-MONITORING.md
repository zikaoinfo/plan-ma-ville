# Suivi SEO automatisé (plan de croissance §5)

Remplace l'export CSV manuel de la Search Console par une mesure hebdomadaire
enregistrée et comparée. Objectif premier : **détecter une perte d'indexation
la semaine où elle commence**, pas trois semaines plus tard — c'est
exactement ce qui s'est produit en août 2026.

```bash
npm run seo:monitor                                  # mesure + enregistrement
node tools/seo-monitor/index.mjs --dry-run           # sans écrire dans Supabase
node tools/seo-monitor/index.mjs --echantillon 80    # échantillon plus large
npm run test:seo                                     # logique pure (sans credentials)
```

Automatisé par `.github/workflows/seo-monitor.yml` (lundi 06:00 UTC +
déclenchement manuel). Le résumé est publié dans l'onglet *Summary* du run.

## Ce que le script mesure

| Métrique | Source | Fiabilité |
|---|---|---|
| Impressions, clics, CTR, position moyenne | Search Analytics API | exacte |
| Top 20 requêtes | Search Analytics API | exacte |
| Pages indexées, taux d'indexation | URL Inspection API, **par échantillonnage** | estimée |
| Taux d'indexation **par segment** de sitemap | idem | estimée |

### Pourquoi les pages indexées sont estimées

**Le rapport « Pages » de la Search Console n'a pas d'API.** Le chiffre lu dans
l'interface (« 18 668 pages indexées ») n'est exposé nulle part. Les
contournements possibles :

- l'API Sitemaps renvoie un champ `indexed`, mais Google le laisse à zéro
  depuis des années — inutilisable ;
- l'**URL Inspection API** donne le verdict réel d'indexation, mais **une URL à
  la fois**, sous quota de 2 000 requêtes/jour et 600/minute par propriété.

Le script inspecte donc un échantillon par segment de sitemap (40 URLs par
défaut, soit ~200 requêtes par run — très en deçà du quota) et extrapole le
total en pondérant chaque taux par la taille de son segment. C'est justement
ce que la segmentation du sitemap (§4) rend possible : on sait si ce sont les
28 000 petites communes qui ne s'indexent pas, ou le site indistinctement.

L'échantillon est tiré avec une **graine fixe** : d'une semaine à l'autre, ce
sont les mêmes URLs qui sont réinterrogées, donc la variation mesurée est un
vrai mouvement, pas du bruit d'échantillonnage.

Une inspection en échec (quota, réseau) est **exclue du dénominateur** — la
compter comme « non indexée » produirait une fausse alerte.

## Alerte

Le script alerte quand les **pages indexées** reculent de plus de **5 %** d'une
mesure à l'autre : sortie en code 2 (le job CI devient rouge, donc visible) et,
si `SLACK_WEBHOOK_URL` est défini, un message Slack.

Une chute d'**impressions** seule n'alerte pas : c'est saisonnier et bruité,
là où un recul du nombre de pages indexées est structurel.

## Configuration (à faire une fois)

### 1. Compte de service Google

1. [Google Cloud Console](https://console.cloud.google.com/) → nouveau projet
   (ou existant) → **APIs & Services** → activer **Google Search Console API**.
2. **IAM & Admin → Service Accounts** → créer un compte de service → **Keys →
   Add key → JSON**. Le fichier téléchargé est la clé.
3. **Étape la plus oubliée** : dans la Search Console, *Paramètres →
   Utilisateurs et autorisations → Ajouter un utilisateur*, ajouter l'adresse
   `…@….iam.gserviceaccount.com` du compte de service en **lecture complète**.
   Sans ça, l'API répond 403 (le script le dit explicitement).

### 2. Secrets du dépôt

*Settings → Secrets and variables → Actions*.

| Secret | Contenu |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | le JSON de la clé, brut **ou encodé en base64** |
| `SUPABASE_URL` | déjà présent (déploiement) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé **service role** du projet Supabase |
| `SLACK_WEBHOOK_URL` | *optionnel* — webhook entrant pour l'alerte |

Variable optionnelle : `GSC_SITE_URL` (défaut `https://planmaville.fr/`). Pour
une propriété de type domaine, la valeur est `sc-domain:planmaville.fr`.

> La clé PEM contient des retours à la ligne qui survivent mal au
> copier-coller : `base64 -w0 cle.json` et coller le résultat, le script
> accepte les deux formes.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` contourne les RLS. Elle n'a rien à faire dans
> `environment.ts` ni dans quoi que ce soit d'envoyé au navigateur : elle ne
> sert qu'ici, côté CI.

### 3. Table Supabase

Coller `docs/supabase-migration-seo-metrics.sql` dans *SQL Editor → Run*. La
table a les RLS actives et aucune policy : elle n'est lisible que par la clé
service role.

## Limites assumées

- **Estimation, pas comptage.** Le chiffre de pages indexées ne correspondra
  pas exactement à celui de l'interface Search Console. C'est la *tendance*
  qui compte, et elle est fiable à échantillon constant.
- **Deux jours de décalage.** La Search Console publie ses données avec un
  retard d'environ 48 h : le script analyse une fenêtre de 7 jours se
  terminant il y a 3 jours, pour ne jamais mesurer une période incomplète.
- **Aucune donnée avant la première exécution.** Le premier run n'affiche
  aucun delta et n'alerte pas — il pose la référence.
