-- ════════════════════════════════════════════════════════════════
-- Migration : bornes hautes anti-abus sur les textes des avis.
-- À exécuter dans le SQL Editor Supabase sur une base déjà créée
-- avec une version antérieure de supabase-schema.sql (les nouvelles
-- installations ont déjà ces contraintes).
--
-- Contexte : la clé anon est publique, le formulaire client n'est pas
-- une frontière de confiance. Sans borne haute, un utilisateur
-- authentifié peut insérer des textes de plusieurs Mo (gonflement du
-- stockage et de chaque lecture publique).
-- ════════════════════════════════════════════════════════════════

-- Tronque l'existant au cas où (sinon les ALTER échoueraient).
UPDATE avis SET positifs = left(positifs, 2000) WHERE length(positifs) > 2000;
UPDATE avis SET negatifs = left(negatifs, 2000) WHERE length(negatifs) > 2000;
UPDATE avis SET pseudo = left(pseudo, 80) WHERE length(pseudo) > 80;

ALTER TABLE avis
  ADD CONSTRAINT avis_positifs_max CHECK (length(positifs) <= 2000);
ALTER TABLE avis
  ADD CONSTRAINT avis_negatifs_max CHECK (negatifs IS NULL OR length(negatifs) <= 2000);
ALTER TABLE avis
  ADD CONSTRAINT avis_pseudo_max CHECK (length(pseudo) <= 80);

-- ── Pseudo dérivé côté serveur + lecture des profils restreinte ──
-- (mêmes définitions que dans supabase-schema.sql — voir les commentaires là-bas)
CREATE OR REPLACE FUNCTION public.force_avis_pseudo() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT p.pseudo INTO NEW.pseudo FROM public.profiles p WHERE p.user_id = NEW.user_id;
  NEW.pseudo := COALESCE(NEW.pseudo, 'citoyen');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_pseudo ON avis;
CREATE TRIGGER trg_avis_pseudo
  BEFORE INSERT OR UPDATE ON avis
  FOR EACH ROW EXECUTE FUNCTION public.force_avis_pseudo();

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = user_id);
