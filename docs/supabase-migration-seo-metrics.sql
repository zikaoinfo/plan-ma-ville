-- ════════════════════════════════════════════════════════════════════════
-- ma ville, notée — table de suivi SEO hebdomadaire (plan de croissance §5)
-- À coller dans Supabase → SQL Editor → Run. Idempotent.
--
-- Alimentée par `npm run seo:monitor` (tools/seo-monitor/), lancé chaque
-- semaine par .github/workflows/seo-monitor.yml.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seo_metrics (
  -- Une mesure par date : le script est rejouable (upsert sur cette clé),
  -- relancé le même jour il corrige la ligne au lieu d'en ajouter une
  -- seconde, qui fausserait le delta de la semaine suivante.
  date DATE PRIMARY KEY,
  periode_debut DATE NOT NULL,
  periode_fin DATE NOT NULL,

  -- Search Analytics API (totaux sur la période).
  impressions INT NOT NULL DEFAULT 0,
  clics INT NOT NULL DEFAULT 0,
  ctr FLOAT NOT NULL DEFAULT 0,
  position_moyenne FLOAT NOT NULL DEFAULT 0,

  -- Indexation : ESTIMÉE par échantillonnage (URL Inspection API), car le
  -- rapport « Pages » de la Search Console n'a pas d'API. Voir
  -- tools/seo-monitor/gsc.mjs.
  pages_indexees_estimees INT NOT NULL DEFAULT 0,
  taux_indexation FLOAT NOT NULL DEFAULT 0,
  urls_total INT NOT NULL DEFAULT 0,

  -- Détail par segment de sitemap et top requêtes (JSON : la forme évolue
  -- plus vite que le schéma, et rien ici n'est requêté relationnellement).
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_requetes JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les mesures ne sont pas des données publiques : aucune policy n'est créée,
-- donc RLS active + aucun accès anon. Le script CI écrit avec la clé SERVICE
-- ROLE, qui contourne les RLS.
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE seo_metrics IS
  'Suivi SEO hebdomadaire (Search Console). Écrit par tools/seo-monitor en CI.';

-- ── Baseline de citation IA (plan de croissance §6) ──
-- Alimentée par `npm run seo:citation` (tools/seo-monitor/ai-citation.mjs),
-- à lancer MENSUELLEMENT : chaque ville coûte une requête avec recherche web.
CREATE TABLE IF NOT EXISTS ai_citations (
  date DATE PRIMARY KEY,
  domaine TEXT NOT NULL,
  -- Un objet par moteur interrogé (claude, perplexity…) : taux de citation,
  -- ventilation « nommé dans la réponse » vs « source consultée », et le
  -- détail par ville. JSON car la liste des moteurs évoluera.
  moteurs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ai_citations IS
  'Baseline de citation par les moteurs de réponse IA. Écrit par tools/seo-monitor/ai-citation.mjs.';
