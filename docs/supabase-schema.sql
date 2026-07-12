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

-- Création de profil à l'inscription.
-- IMPORTANT : ce trigger s'exécute DANS la transaction d'insertion de
-- auth.users. S'il lève une erreur, tout le signup est annulé
-- (« Database error saving new user ») — ce qui casse Google ET le magic-link.
-- Il doit donc : (1) toujours fournir un pseudo non-null et unique, même quand
-- l'IdP (Google) n'en renvoie pas ; (2) ne JAMAIS bloquer la création du compte.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_pseudo TEXT;
  final_pseudo TEXT;
  n INT := 0;
BEGIN
  -- Base : full_name / name renvoyés par l'IdP, sinon partie locale de l'email.
  base_pseudo := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'citoyen'
  );
  -- Normalisation : minuscules, alphanumérique + tirets.
  base_pseudo := lower(regexp_replace(base_pseudo, '[^a-zA-Z0-9]+', '-', 'g'));
  base_pseudo := NULLIF(trim(BOTH '-' FROM base_pseudo), '');
  base_pseudo := COALESCE(base_pseudo, 'citoyen');

  -- Insertion avec suffixe anti-collision (gère aussi la course entre 2 signups
  -- grâce au retry sur unique_violation).
  final_pseudo := base_pseudo;
  LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, pseudo)
      VALUES (NEW.id, final_pseudo);
      EXIT; -- succès
    EXCEPTION
      WHEN unique_violation THEN
        -- profil déjà créé pour cet utilisateur → on s'arrête
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
          EXIT;
        END IF;
        -- sinon c'est le pseudo qui est pris → on suffixe et on réessaie
        n := n + 1;
        final_pseudo := base_pseudo || '-' || n::text;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION
  -- Garde-fou ultime : aucune erreur ici ne doit empêcher l'inscription.
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- Remplace l'ancien trigger/fonction (versions antérieures de ce schéma).
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_profile();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
