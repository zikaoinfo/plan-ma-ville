# Spec — Avis en mode invité (défaut) + email optionnel

**Objectif** : n'importe quel visiteur peut publier un avis SANS créer de compte
(mode par défaut). La connexion (Google / magic-link) reste possible mais
devient secondaire. Un champ email **optionnel** permet de « garder » ses avis ;
l'unicité du contributeur est garantie sans fingerprinting, en conformité RGPD.

## 1. Principe central : Supabase *Anonymous Sign-Ins*

La brique qui fait tout tenir : `client.auth.signInAnonymously()` crée un
**vrai** utilisateur `auth.users` (avec `is_anonymous = true` dans le JWT),
dont la session persiste en localStorage comme n'importe quelle session.

Conséquences (c'est là que le plan devient trivial) :

- **Rien ne change dans `avis`** : `user_id` reste NOT NULL et référencé,
  `UNIQUE (user_id, commune_insee)` continue de garantir **1 avis par
  contributeur par commune** (même appareil = même identité, session
  restaurée à chaque visite → l'invité peut relire ET modifier son avis).
- **RLS inchangée** : `auth.uid() = user_id` fonctionne pour un anonyme.
- **Aucune donnée personnelle collectée** : l'identifiant invité est un UUID
  opaque, stocké chez l'utilisateur (localStorage), sans IP, sans cookie
  tiers, sans empreinte navigateur. RGPD : pseudonymisation par conception,
  minimisation maximale (§5).

### Parcours invité (défaut)

1. Onglet « Avis habitants » → le **formulaire s'affiche directement**
   (plus d'auth-gate bloquante).
2. Au clic « Publier » : `ensureUser()` — s'il n'y a pas de session,
   `signInAnonymously()` silencieux, puis `submitAvis()` comme aujourd'hui.
3. L'avis est publié sous « Habitant anonyme » (le trigger serveur
   `force_avis_pseudo` gère déjà ce cas : profil sans `nom_complet` →
   pseudo « Habitant »). Voir §3 pour le pseudo invité.

### Email optionnel = « claim » du compte, unicité gratuite

Champ optionnel dans le formulaire : *« Votre email (optionnel) — pour
retrouver et modifier vos avis depuis n'importe quel appareil. »*

- Si rempli → après le submit, `client.auth.updateUser({ email })` :
  Supabase envoie un **email de confirmation** qui convertit l'utilisateur
  anonyme en compte permanent, **en conservant le même `user_id`** (donc
  tous ses avis).
- **Unicité RGPD-compatible sans invention** : Supabase impose nativement
  qu'un email n'appartienne qu'à UN utilisateur, et la confirmation par lien
  **prouve la possession** de l'adresse — plus fort et plus honnête que tout
  hash/fingerprint. Aucune table d'emails à maintenir, l'email ne vit que
  dans `auth.users`.
- **Conflit** (email déjà pris) : Supabase renvoie `email_exists` → l'UI
  propose « Cet email a déjà un compte — recevoir un lien de connexion ? »
  (magic-link existant). Le formulaire garde ses valeurs en mémoire ; au
  retour OAuth/magic-link (`?onglet=avis` déjà géré), l'avis est re-soumis
  en upsert sur le compte connecté.

### Connexion classique (secondaire)

- L'`auth-gate` actuelle devient un repli discret sous le formulaire :
  « Déjà un compte ? Se connecter » (repliable), Google + magic-link inchangés.
- Utilisateur anonyme qui clique Google : `client.auth.linkIdentity({provider:
  'google'})` (nécessite *manual linking* activé) → rattache l'identité Google
  au même `user_id`, les avis invités sont conservés. Si l'identité Google
  appartient déjà à un autre compte → repli sur `signInWithOAuth` classique
  (les avis de CE compte reprennent la main ; l'avis en cours de saisie est
  re-soumis comme ci-dessus).

## 2. Configuration Supabase (dashboard, côté proprio)

1. **Auth → Sign In / Up → Anonymous sign-ins : ON.**
2. **Auth → Manual linking : ON** (pour `linkIdentity`).
3. Anti-abus (la création d'anonymes est un endpoint public) :
   - Rate limits intégrés (défaut : 30 anonymes / h / IP — suffisant v1) ;
   - Option v1.1 : **CAPTCHA Cloudflare Turnstile** (intégration Supabase
     native, sans cookie, RGPD-ok) sur le seul `signInAnonymously`.

## 3. Schéma SQL (docs/supabase-schema.sql + migration idempotente)

- `handle_new_user` : fonctionne déjà pour un anonyme (email NULL → base
  `citoyen`). Ajustement : si `NEW.is_anonymous`, pseudo technique
  `invite-<8 hex du user_id>` (pas de collision, pas d'appel aléatoire).
- `force_avis_pseudo` : déjà correct (anonyme/sans nom → « Habitant » /
  « Habitant anonyme »). **Touche déterministe sympa (optionnelle)** : pour un
  invité non-anonyme-coché, dériver un pseudonyme lisible du `user_id`
  (ex. « Habitant #4F2A ») — identifiant stable entre ses avis, zéro PII.
- **Purge RGPD / hygiène** : job SQL documenté (à lancer via cron Supabase) :
  `DELETE FROM auth.users WHERE is_anonymous AND created_at < now() - interval '30 days' AND id NOT IN (SELECT user_id FROM avis);`
  (les anonymes AVEC avis sont conservés : ce sont des contributeurs actifs).
- RLS : inchangée. Option durcissement : bloquer `UPDATE profiles.villes_suivies`
  n'est pas nécessaire (fonctionne aussi pour un invité — bonus Phase 12).

## 4. Côté client (Angular)

| Fichier | Changement |
|---|---|
| `core/services/auth.service.ts` | `estAnonyme = computed(() => user()?.is_anonymous === true)` ; `ensureUser()` (session existante sinon `signInAnonymously`) ; `attacherEmail(email)` (`updateUser`, mappe `email_exists`) ; `lierGoogle()` (`linkIdentity` si anonyme, sinon OAuth). |
| `commune-avis-form.ts` | Plus de dépendance à un user connecté : formulaire toujours rendu ; `submit()` appelle `ensureUser()` d'abord ; champ email optionnel + microcopie finalité (« pour retrouver vos avis… ») ; états : `ok` / `ok-verifier-email` / `email-pris` (bouton magic-link) ; brouillon conservé en signal pour re-soumission post-login. |
| `commune.ts` (onglet avis) | Retirer l'auth-gate bloquante ; formulaire direct + lien repliable « Déjà un compte ? » qui affiche `app-auth-gate`. |
| `shared/auth-gate` | Prop `message` adaptée (« Retrouvez vos avis sur tous vos appareils ») ; inchangée sinon. |
| Header (menu compte) | Un anonyme ne doit PAS apparaître « connecté » : masquer le menu si `estAnonyme()` (ou afficher un badge « invité » + entrée « garder mes avis » → mini-form email). |
| Dégradation | Supabase non configuré → onglet « bientôt » comme aujourd'hui (aucun changement). |

Pièges zoneless déjà connus : callbacks Supabase → `signal.set()` (OK),
validation au clic (pas de bouton grisé réactif), `?onglet=avis` survit au
retour OAuth (déjà en place).

## 5. RGPD (à documenter dans la page Méthodologie/Confidentialité)

- **Minimisation** : mode par défaut = zéro donnée personnelle (UUID opaque
  côté client uniquement). Ni IP, ni empreinte, ni cookie de tracking.
- **Email = consentement explicite** : champ optionnel, finalité unique
  affichée à côté du champ, prouvé par double opt-in (lien de confirmation).
- **Droits** : modification/suppression de son avis déjà couvertes par RLS ;
  ajouter un bouton « Supprimer mon avis » dans le formulaire en mode
  `existing` (DELETE déjà autorisé par la policy). Invité qui vide son
  localStorage = perte d'accès assumée (expliquée dans la microcopie email).
- **Rétention** : purge à 30 j des comptes anonymes sans contribution (§3).

## 6. Tests

- `auth.service.spec` : `ensureUser()` (session absente → signInAnonymously ;
  présente → no-op), `estAnonyme`, mapping `email_exists`.
- `commune-avis-form.spec` : submit invité (ensureUser appelé avant upsert),
  email optionnel vide → pas d'`updateUser`, email rempli → `updateUser`,
  conflit → état `email-pris`, brouillon conservé.
- Existant à adapter : specs qui supposaient la gate bloquante.

## 7. Découpage en commits

1. SQL : migration anonymes + purge + ajustement `handle_new_user` (+ doc §2).
2. `AuthService` : ensureUser / estAnonyme / attacherEmail / lierGoogle + tests.
3. Formulaire + onglet : invité par défaut, email optionnel, gate repliable + tests.
4. Header (état invité) + page confidentialité (mentions RGPD) + TODO/CLAUDE.md.
