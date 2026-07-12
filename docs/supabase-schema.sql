-- ════════════════════════════════════════════════════════════════════════
-- ma ville, notée — schéma Supabase (features communautaires : avis + profils)
-- À coller dans Supabase → SQL Editor → Run. Idempotent (IF NOT EXISTS).
-- Réf. : docs/SPEC-PHASES-7-12.md §2.
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Cache des notes par commune (rempli par trigger depuis avis) ──
CREATE TABLE IF NOT EXISTS communes_stats (
  code_insee TEXT PRIMARY KEY,
  note_habitants FLOAT,
  nb_avis INT DEFAULT 0,
  resume_ia TEXT,
  resume_ia_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Avis habitants ──
CREATE TABLE IF NOT EXISTS avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_insee TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  note_securite SMALLINT NOT NULL CHECK (note_securite BETWEEN 1 AND 10),
  note_sante SMALLINT NOT NULL CHECK (note_sante BETWEEN 1 AND 10),
  note_commerces SMALLINT NOT NULL CHECK (note_commerces BETWEEN 1 AND 10),
  note_enseignement SMALLINT NOT NULL CHECK (note_enseignement BETWEEN 1 AND 10),
  note_sports SMALLINT NOT NULL CHECK (note_sports BETWEEN 1 AND 10),
  note_culture SMALLINT NOT NULL CHECK (note_culture BETWEEN 1 AND 10),
  note_transports SMALLINT NOT NULL CHECK (note_transports BETWEEN 1 AND 10),
  note_niveau_vie SMALLINT NOT NULL CHECK (note_niveau_vie BETWEEN 1 AND 10),
  -- même pondération que le pipeline open data (Σ poids = 8.5)
  note_globale FLOAT GENERATED ALWAYS AS (
    (note_securite * 1.5 + note_sante * 1.2 + note_commerces + note_enseignement +
     note_sports * 0.8 + note_culture * 0.8 + note_transports * 1.2 + note_niveau_vie) / 8.5
  ) STORED,
  positifs TEXT NOT NULL CHECK (length(positifs) >= 20),
  negatifs TEXT,
  pseudo TEXT NOT NULL,
  UNIQUE (user_id, commune_insee)  -- 1 avis par utilisateur par commune
);

CREATE INDEX IF NOT EXISTS idx_avis_commune ON avis (commune_insee, created_at DESC);

-- ── Trigger : recalcul de communes_stats ──
CREATE OR REPLACE FUNCTION sync_commune_stats() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO communes_stats (code_insee, note_habitants, nb_avis, updated_at)
  SELECT commune_insee,
         ROUND(AVG(note_globale)::NUMERIC, 1),
         COUNT(*),
         now()
  FROM avis
  WHERE commune_insee = COALESCE(NEW.commune_insee, OLD.commune_insee)
  GROUP BY commune_insee
  ON CONFLICT (code_insee) DO UPDATE SET
    note_habitants = EXCLUDED.note_habitants,
    nb_avis = EXCLUDED.nb_avis,
    updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_stats ON avis;
CREATE TRIGGER trg_avis_stats
  AFTER INSERT OR UPDATE OR DELETE ON avis
  FOR EACH ROW EXECUTE FUNCTION sync_commune_stats();

-- ── Profils (pseudo + villes suivies) ──
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo TEXT UNIQUE NOT NULL,
  villes_suivies TEXT[] DEFAULT '{}'
);

CREATE OR REPLACE FUNCTION create_profile() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (user_id, pseudo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile();

-- ── Row Level Security ──
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avis_select" ON avis;
CREATE POLICY "avis_select" ON avis FOR SELECT USING (true);
DROP POLICY IF EXISTS "avis_insert" ON avis;
CREATE POLICY "avis_insert" ON avis FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "avis_update" ON avis;
CREATE POLICY "avis_update" ON avis FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "avis_delete" ON avis;
CREATE POLICY "avis_delete" ON avis FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "communes_stats_select" ON communes_stats;
CREATE POLICY "communes_stats_select" ON communes_stats FOR SELECT USING (true);
-- communes_stats n'est modifiée que par le trigger (SECURITY DEFINER).

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);
