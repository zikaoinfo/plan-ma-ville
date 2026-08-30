# Architecture — Supabase (avis + auth, Phase 7)

Détail extrait de `CLAUDE.md` (chargé à la demande). Voir aussi
`docs/SPEC-AVIS-INVITE.md` et `docs/supabase-schema.sql`.

## Supabase (Phase 7 — avis + auth)

- **Avis en mode INVITÉ par défaut** (`docs/SPEC-AVIS-INVITE.md`) : le
  formulaire est ouvert à tous ; au premier « Publier », `AuthService.ensureUser()`
  crée une session **anonymous sign-in** silencieuse (UUID opaque, zéro PII,
  session localStorage → 1 avis/commune/contributeur via l'UNIQUE existant).
  Email **optionnel** dans le formulaire = `attacherEmail()` (`updateUser`)
  APRÈS publication : conversion invité → compte permanent, même `user_id`
  (avis conservés), unicité email native (`email_exists` → propose le
  magic-link, PAS de re-soumission : doublon sinon). `loginWithGoogle()` d'un
  invité passe par `linkIdentity` (avis conservés, repli OAuth classique).
  Header : utiliser `connecteCompte()` (un invité ne s'affiche pas connecté).
  Pseudo public des comptes sans nom IdP = « Habitant #XXXX » stable (dérivé
  du user_id, trigger `force_avis_pseudo`). Dashboard requis : **Allow
  anonymous sign-ins** + **Allow manual linking** ; purge pg_cron des invités
  sans avis > 30 j (fin du schéma SQL).
- **Dégradation gracieuse** : si `environment.supabaseUrl` n'est pas une vraie
  URL http (placeholder/vide), `SupabaseService.enabled=false`, `client=null`,
  toutes les méthodes renvoient `[]`/`null` → onglet avis « bientôt », pas de crash.
- **Env** : `environment.ts` contient des placeholders `__SUPABASE_URL__` /
  `__SUPABASE_ANON_KEY__` / `__WORKER_URL__`, remplacés en CI par une étape `sed`
  dans `deploy.yml` depuis les secrets GitHub. `environment.development.ts` vide
  (auth off en local — y mettre ses clés pour tester, ne pas commiter).
- **Activation** (côté proprio) : coller `docs/supabase-schema.sql` ; activer le
  provider Email + Google ; secrets GitHub `SUPABASE_URL`/`SUPABASE_ANON_KEY` ;
  autoriser les Redirect URLs (localhost + github.io).
- **Piège trigger** : la création de profil s'exécute dans la transaction
  d'`auth.users` → doit fournir un pseudo non-null unique et **ne jamais lever**
  (sinon « Database error saving new user » casse Google + magic-link). Corrigé
  dans le schéma (`handle_new_user`, garde-fou `WHEN OTHERS`).
- **Header** : menu compte (avatar Google/initiales, pseudo, email, déconnexion)
  affiché si Supabase configuré. `auth.user()` signal ; callbacks Supabase → `set()`
  déclenche la CD en zoneless.

