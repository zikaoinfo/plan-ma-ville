-- ════════════════════════════════════════════════════════════════
-- Migration : avis en mode invité (anonymous sign-ins) + pseudonyme
-- stable « Habitant #XXXX » — réf. docs/SPEC-AVIS-INVITE.md.
-- À exécuter dans le SQL Editor Supabase sur une base déjà créée avec
-- une version antérieure de supabase-schema.sql (les nouvelles
-- installations ont déjà tout ceci).
--
-- ⚠ Config dashboard REQUISE en plus de ce SQL :
--   1. Authentication → Sign In / Up → « Allow anonymous sign-ins » : ON.
--   2. Authentication → Sign In / Up → « Allow manual linking » : ON.
--   3. (optionnel) CAPTCHA Turnstile : Auth → Attack protection.
-- ════════════════════════════════════════════════════════════════

-- ── handle_new_user : pseudo technique pour les comptes anonymes ──
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

  IF NEW.is_anonymous THEN
    -- Invité (anonymous sign-in) : ni email ni métadonnées IdP. Pseudo
    -- technique stable dérivé de l'id — jamais affiché tel quel
    -- (force_avis_pseudo calcule le nom public « Habitant #XXXX »).
    base_pseudo := 'invite-' || left(replace(NEW.id::text, '-', ''), 12);
  ELSE
    base_pseudo := COALESCE(
      nom_complet_brut,
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'citoyen'
    );
    base_pseudo := lower(regexp_replace(base_pseudo, '[^a-zA-Z0-9]+', '-', 'g'));
    base_pseudo := NULLIF(trim(BOTH '-' FROM base_pseudo), '');
    base_pseudo := COALESCE(base_pseudo, 'citoyen');
  END IF;

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

-- ── force_avis_pseudo : « Habitant #XXXX » pour les comptes sans nom IdP ──
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
    -- Sans nom IdP (invité anonyme ou compte magic-link) : pseudonyme lisible
    -- et STABLE dérivé de l'id (zéro PII) — le même « Habitant #A3F2 » signe
    -- tous les avis du contributeur, y compris après conversion invité → compte.
    NEW.pseudo := 'Habitant #' || upper(left(replace(NEW.user_id::text, '-', ''), 4));
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

-- Recalcule le pseudo affiché des avis déjà publiés par des comptes sans nom
-- (« Habitant » → « Habitant #XXXX ») : UPDATE no-op, seul le trigger BEFORE
-- UPDATE nous intéresse.
UPDATE avis SET anonyme = anonyme;

-- ── Hygiène RGPD : purge hebdomadaire des invités inactifs ──
-- Nécessite l'extension pg_cron (Dashboard → Database → Extensions).
-- Un compte anonyme SANS avis de plus de 30 jours est une session perdue ;
-- les invités AVEC avis sont conservés (contributeurs actifs).
-- SELECT cron.schedule('purge-invites', '0 3 * * 0', $purge$
--   DELETE FROM auth.users u
--   WHERE u.is_anonymous
--     AND u.created_at < now() - interval '30 days'
--     AND NOT EXISTS (SELECT 1 FROM public.avis a WHERE a.user_id = u.id);
-- $purge$);
