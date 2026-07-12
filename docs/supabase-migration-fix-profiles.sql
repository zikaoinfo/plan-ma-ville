-- ════════════════════════════════════════════════════════════════════════
-- CORRECTIF — « Database error saving new user » (Google + magic-link)
-- À exécuter dans Supabase → SQL Editor si tu as déjà lancé v1 du schéma.
--
-- Cause : le trigger de création de profil insérait un pseudo NULL (Google
-- n'en fournit pas) → violation NOT NULL / UNIQUE → rollback de l'insertion
-- dans auth.users → l'inscription échoue et aucun email n'est envoyé.
--
-- Ce correctif rend le trigger robuste et NON bloquant.
-- ════════════════════════════════════════════════════════════════════════

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
  base_pseudo := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'citoyen'
  );
  base_pseudo := lower(regexp_replace(base_pseudo, '[^a-zA-Z0-9]+', '-', 'g'));
  base_pseudo := NULLIF(trim(BOTH '-' FROM base_pseudo), '');
  base_pseudo := COALESCE(base_pseudo, 'citoyen');

  final_pseudo := base_pseudo;
  LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, pseudo) VALUES (NEW.id, final_pseudo);
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
    RETURN NEW; -- ne jamais bloquer l'inscription
END;
$$;

DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_profile();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optionnel : crée les profils manquants pour les comptes déjà inscrits
-- pendant que le trigger était cassé.
INSERT INTO public.profiles (user_id, pseudo)
SELECT u.id,
       COALESCE(
         NULLIF(lower(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9]+', '-', 'g')), ''),
         'citoyen'
       ) || '-' || substr(u.id::text, 1, 4)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT DO NOTHING;
