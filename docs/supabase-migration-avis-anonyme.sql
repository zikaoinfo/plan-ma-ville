-- ════════════════════════════════════════════════════════════════
-- Migration : avis anonyme + pseudo lisible ("Jean D.") au lieu du
-- slug technique ("jean-dupont-3").
-- À exécuter dans le SQL Editor Supabase sur une base déjà créée avec
-- une version antérieure de supabase-schema.sql (les nouvelles
-- installations ont déjà tout ceci).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE avis ADD COLUMN IF NOT EXISTS anonyme BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom_complet TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anonyme_defaut BOOLEAN NOT NULL DEFAULT false;

-- Rétro-remplissage best-effort du nom complet depuis les métadonnées IdP
-- déjà stockées sur auth.users (uniquement les profils qui n'en ont pas).
UPDATE public.profiles p
SET nom_complet = COALESCE(
  NULLIF(u.raw_user_meta_data->>'full_name', ''),
  NULLIF(u.raw_user_meta_data->>'name', '')
)
FROM auth.users u
WHERE u.id = p.user_id AND p.nom_complet IS NULL;

-- ── handle_new_user : stocke aussi le nom complet brut (non slugifié) ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_pseudo TEXT;
  final_pseudo TEXT;
  nom_complet_brut TEXT;
  n INT := 0;
BEGIN
  nom_complet_brut := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', '')
  );

  base_pseudo := COALESCE(
    nom_complet_brut,
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'citoyen'
  );
  base_pseudo := lower(regexp_replace(base_pseudo, '[^a-zA-Z0-9]+', '-', 'g'));
  base_pseudo := NULLIF(trim(BOTH '-' FROM base_pseudo), '');
  base_pseudo := COALESCE(base_pseudo, 'citoyen');

  final_pseudo := base_pseudo;
  LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, pseudo, nom_complet)
      VALUES (NEW.id, final_pseudo, nom_complet_brut);
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
          EXIT;
        END IF;
        n := n + 1;
        final_pseudo := base_pseudo || '-' || n::text;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- ── force_avis_pseudo : "Prénom I." ou "Habitant anonyme" ──
CREATE OR REPLACE FUNCTION public.force_avis_pseudo() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nom TEXT;
  prenom TEXT;
  reste TEXT;
BEGIN
  IF NEW.anonyme THEN
    NEW.pseudo := 'Habitant anonyme';
    RETURN NEW;
  END IF;

  SELECT p.nom_complet INTO nom FROM public.profiles p WHERE p.user_id = NEW.user_id;
  nom := trim(COALESCE(nom, ''));
  IF nom = '' THEN
    NEW.pseudo := 'Habitant';
    RETURN NEW;
  END IF;

  prenom := split_part(nom, ' ', 1);
  reste := trim(substring(nom FROM length(prenom) + 1));
  NEW.pseudo := CASE
    WHEN reste = '' THEN prenom
    ELSE prenom || ' ' || upper(left(reste, 1)) || '.'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avis_pseudo ON avis;
CREATE TRIGGER trg_avis_pseudo
  BEFORE INSERT OR UPDATE ON avis
  FOR EACH ROW EXECUTE FUNCTION public.force_avis_pseudo();

-- Recalcule le pseudo affiché des avis déjà publiés avec l'ancien format
-- slug (UPDATE no-op : la valeur ne change pas, seul le trigger BEFORE
-- UPDATE nous intéresse, il retombe toujours sur force_avis_pseudo).
UPDATE avis SET anonyme = anonyme;
