# SPEC-PHASES-7-12 — ma-ville-notée (plan-ma-ville)
> Complément de `SPEC-DATA.md` et `SPEC-PHASES-2-6.md`.
> Objectif : concurrencer ville-ideale.fr.
> **Contrainte hard** : GitHub Pages (statique). Pas de SSR.
> Nouvelles dépendances autorisées : Supabase JS client (avis/auth uniquement),
> Leaflet (carte), Cloudflare Workers (proxy Claude API).
> Toutes les conventions CLAUDE.md s'appliquent sans exception.

---

## §0 — Décisions d'architecture (à lire avant de coder)

### Données statiques vs dynamiques

| Donnée | Stockage | Mise à jour |
|--------|----------|-------------|
| Notes open data (8 critères) | `public/data/dep/*.json` (existant) | CI `data:build` |
| Index recherche | `public/data/index.json` (existant) | CI |
| Avis habitants | **Supabase** (nouveau) | Realtime |
| Auth utilisateur | **Supabase Auth** (nouveau) | — |
| Résumés IA | **Supabase** colonne `communes.resume_ia` | Cloudflare Worker |
| Carte GeoJSON | `public/data/geo-communes.geojson` (nouveau, généré) | CI |

### Supabase — périmètre minimal

Seules les features **communautaires** (avis, auth, résumé IA) utilisent
Supabase. Le reste continue d'utiliser les JSON statiques existants.
Variable d'environnement : `environment.supabaseUrl` + `environment.supabaseAnonKey`
(dans `src/environments/environment.ts`, jamais hardcodé).

### `baseHref` = `/plan-ma-ville/` (inchangé)

Les URLs de données restent `data/xxx.json` (chemin relatif à `baseURI`).

---

## §1 — Modèles TypeScript à ajouter

À ajouter dans `src/app/core/models/data.models.ts` (ne pas modifier l'existant) :

```typescript
// ─── Avis habitant (Supabase) ───────────────────────────────────────────────
export const CRITERE_KEYS = [
  'securite','sante','commerces','enseignement',
  'sports','culture','transports','niveauVie',
] as const; // même ordre que CRITERES existant

export interface Avis {
  id: string;
  commune_insee: string;   // code INSEE (= SearchIndexItem.i)
  user_id: string;
  created_at: string;      // ISO
  // notes 1–10 par critère (même clés que CRITERE_KEYS)
  note_securite: number;
  note_sante: number;
  note_commerces: number;
  note_enseignement: number;
  note_sports: number;
  note_culture: number;
  note_transports: number;
  note_niveau_vie: number;
  note_globale: number;    // calculé Supabase (GENERATED STORED)
  positifs: string;
  negatifs: string;
  pseudo: string;          // dénormalisé depuis profiles
  resume_ia?: string;      // généré async
}

export interface AvisInsert extends Omit<Avis, 'id'|'created_at'|'note_globale'|'resume_ia'> {}

// ─── Commune enrichie (statique + Supabase) ──────────────────────────────────
export interface CommuneEnriched {
  // depuis dep/{d}.json (existant)
  detail: CommuneDetail;
  // depuis Supabase (peut être null si aucun avis)
  noteHabitants: number | null;
  nbAvis: number;
  resumeIa: string | null;
}

// ─── Classement avec avis ────────────────────────────────────────────────────
export interface ClassementEntryV2 extends ClassementEntry {
  noteHabitants: number | null;
  nbAvis: number;
}

// ─── Quiz matching ────────────────────────────────────────────────────────────
export interface QuizReponses {
  profil: 'famille' | 'jeune_actif' | 'teletravailleur' | 'retraite';
  priorite1: Critere;
  priorite2: Critere;
  region: string | 'indifferent';
  taille: 'petite' | 'moyenne' | 'grande' | 'indifferent';
}

export interface QuizMatch {
  slug: string;
  nom: string;
  departement: string;
  scoreMatch: number;   // 0–100
  raison: string;
}

// ─── Signalement urbain ───────────────────────────────────────────────────────
export type SignalementCategorie = 'proprete' | 'securite' | 'voirie' | 'autre';
export interface Signalement {
  id: string;
  commune_insee: string;
  user_id: string;
  created_at: string;
  lat: number;
  lng: number;
  categorie: SignalementCategorie;
  description: string;
  statut: 'ouvert' | 'traite';
}
```

---

## §2 — Supabase : schéma SQL complet

```sql
-- Activer les extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Cache notes par commune (sync depuis avis via trigger)
CREATE TABLE IF NOT EXISTS communes_stats (
  code_insee TEXT PRIMARY KEY,
  note_habitants FLOAT,
  nb_avis INT DEFAULT 0,
  resume_ia TEXT,
  resume_ia_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Avis habitants
CREATE TABLE IF NOT EXISTS avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_insee TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  note_securite SMALLINT NOT NULL CHECK(note_securite BETWEEN 1 AND 10),
  note_sante SMALLINT NOT NULL CHECK(note_sante BETWEEN 1 AND 10),
  note_commerces SMALLINT NOT NULL CHECK(note_commerces BETWEEN 1 AND 10),
  note_enseignement SMALLINT NOT NULL CHECK(note_enseignement BETWEEN 1 AND 10),
  note_sports SMALLINT NOT NULL CHECK(note_sports BETWEEN 1 AND 10),
  note_culture SMALLINT NOT NULL CHECK(note_culture BETWEEN 1 AND 10),
  note_transports SMALLINT NOT NULL CHECK(note_transports BETWEEN 1 AND 10),
  note_niveau_vie SMALLINT NOT NULL CHECK(note_niveau_vie BETWEEN 1 AND 10),
  note_globale FLOAT GENERATED ALWAYS AS (
    (note_securite*1.5 + note_sante*1.2 + note_commerces + note_enseignement +
     note_sports*0.8 + note_culture*0.8 + note_transports*1.2 + note_niveau_vie) / 8.5
  ) STORED,
  positifs TEXT NOT NULL CHECK(length(positifs) >= 20),
  negatifs TEXT,
  pseudo TEXT NOT NULL,
  UNIQUE(user_id, commune_insee)  -- 1 avis par user par commune
);

-- Trigger recalcul communes_stats
CREATE OR REPLACE FUNCTION sync_commune_stats() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO communes_stats(code_insee, note_habitants, nb_avis, updated_at)
    SELECT commune_insee,
           ROUND(AVG(note_globale)::NUMERIC, 1),
           COUNT(*),
           now()
    FROM avis WHERE commune_insee = COALESCE(NEW.commune_insee, OLD.commune_insee)
    GROUP BY commune_insee
  ON CONFLICT(code_insee) DO UPDATE SET
    note_habitants = EXCLUDED.note_habitants,
    nb_avis = EXCLUDED.nb_avis,
    updated_at = now();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_avis_stats
  AFTER INSERT OR UPDATE OR DELETE ON avis
  FOR EACH ROW EXECUTE FUNCTION sync_commune_stats();

-- Signalements
CREATE TABLE IF NOT EXISTS signalements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_insee TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  categorie TEXT NOT NULL CHECK(categorie IN ('proprete','securite','voirie','autre')),
  description TEXT NOT NULL CHECK(length(description) >= 10),
  statut TEXT DEFAULT 'ouvert' CHECK(statut IN ('ouvert','traite'))
);

-- Profils
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo TEXT UNIQUE NOT NULL,
  villes_suivies TEXT[] DEFAULT '{}'
);
CREATE OR REPLACE FUNCTION create_profile() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles(user_id, pseudo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_new_user AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile();

-- RLS
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avis_select" ON avis FOR SELECT USING (true);
CREATE POLICY "avis_insert" ON avis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "avis_update" ON avis FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "signalements_select" ON signalements FOR SELECT USING (true);
CREATE POLICY "signalements_insert" ON signalements FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "communes_stats_select" ON communes_stats FOR SELECT USING (true);
-- communes_stats modifiée uniquement par trigger (SECURITY DEFINER)

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);
```

---

## §3 — Nouveaux services

### `src/app/core/services/supabase.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey
  );
}
```

### `src/app/core/services/auth.service.ts`
```typescript
import { Injectable, signal, inject } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly #sb = inject(SupabaseService);
  readonly user = signal<User | null>(null);

  constructor() {
    this.#sb.client.auth.getSession().then(({ data }) =>
      this.user.set(data.session?.user ?? null)
    );
    this.#sb.client.auth.onAuthStateChange((_, s) =>
      this.user.set(s?.user ?? null)
    );
  }

  loginWithGoogle() {
    return this.#sb.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }

  async loginWithEmail(email: string) {
    return this.#sb.client.auth.signInWithOtp({ email,
      options: { emailRedirectTo: window.location.href } });
  }

  logout() { return this.#sb.client.auth.signOut(); }
}
```

### `src/app/core/services/avis.service.ts`
```typescript
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Avis, AvisInsert } from '../models/data.models';

@Injectable({ providedIn: 'root' })
export class AvisService {
  readonly #sb = inject(SupabaseService);

  // Cache par code INSEE
  readonly #cache = new Map<string, Avis[]>();

  async loadAvis(codeInsee: string, page = 0): Promise<Avis[]> {
    const { data, error } = await this.#sb.client
      .from('avis')
      .select('*')
      .eq('commune_insee', codeInsee)
      .order('created_at', { ascending: false })
      .range(page * 10, page * 10 + 9);
    if (error) throw error;
    return data ?? [];
  }

  async loadStats(codeInsee: string) {
    const { data } = await this.#sb.client
      .from('communes_stats')
      .select('note_habitants, nb_avis, resume_ia')
      .eq('code_insee', codeInsee)
      .maybeSingle();
    return data;
  }

  async submitAvis(avis: AvisInsert) {
    const { data, error } = await this.#sb.client
      .from('avis').upsert(avis, { onConflict: 'user_id,commune_insee' });
    if (error) throw error;
    return data;
  }

  async getUserAvis(userID: string, codeInsee: string): Promise<Avis | null> {
    const { data } = await this.#sb.client.from('avis').select('*')
      .eq('user_id', userID).eq('commune_insee', codeInsee).maybeSingle();
    return data;
  }
}
```

### `src/app/core/services/claude-proxy.service.ts`
```typescript
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClaudeProxyService {
  async summarizeAvis(communeNom: string, textes: string): Promise<string> {
    const res = await fetch(`${environment.workerUrl}/summarize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commune: communeNom, textes }),
    });
    if (!res.ok) throw new Error(`Worker error ${res.status}`);
    const { resume } = await res.json();
    return resume as string;
  }

  async matchQuiz(reponses: object, topCommunes: object[]): Promise<object[]> {
    const res = await fetch(`${environment.workerUrl}/quiz-match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reponses, communes: topCommunes.slice(0, 100) }),
    });
    if (!res.ok) throw new Error(`Worker error ${res.status}`);
    return res.json();
  }
}
```

---

## §4 — Arborescence à ajouter (ne pas toucher l'existant)

```
src/app/
├── core/
│   └── services/
│       ├── supabase.service.ts       (nouveau)
│       ├── auth.service.ts           (nouveau)
│       ├── avis.service.ts           (nouveau)
│       └── claude-proxy.service.ts   (nouveau)
├── features/
│   ├── commune/                      (MODIFIER — ajouter onglets)
│   │   ├── commune-avis-list/        (nouveau composant)
│   │   ├── commune-avis-form/        (nouveau composant)
│   │   └── commune-ia-summary/       (nouveau composant)
│   ├── classement/                   (MODIFIER — ajouter col note habitants)
│   ├── carte/                        (NOUVEAU)
│   ├── quiz/                         (NOUVEAU)
│   ├── comparateur/                  (NOUVEAU)
│   └── profil/                       (NOUVEAU)
└── shared/
    ├── note-bar/       (existant, inchangé)
    ├── score-badge/    (existant, inchangé)
    ├── auth-dialog/    (nouveau)
    └── critere-slider/ (nouveau)
```

Nouvelles routes à ajouter dans `app.routes.ts` :
```typescript
{ path: 'carte',      loadComponent: () => import('./features/carte/carte.component') },
{ path: 'quiz',       loadComponent: () => import('./features/quiz/quiz.component') },
{ path: 'comparer',   loadComponent: () => import('./features/comparateur/comparateur.component') },
{ path: 'profil',     loadComponent: () => import('./features/profil/profil.component'),
                      canActivate: [() => inject(AuthService).user() !== null] },
```

---

## §5 — Phase 7 : Avis communautaires (core feature)

### Prompt Claude Code

```
Lis CLAUDE.md, docs/SPEC-DATA.md et docs/SPEC-PHASES-7-12.md §0 à §4.

Contexte : la fiche commune (features/commune/) affiche déjà les 8 notes
open data via NoteBarComponent. Il faut ajouter la dimension communautaire
SANS casser l'existant.

TÂCHE 1 — Ajouter Supabase
- npm install @supabase/supabase-js
- Créer src/environments/environment.ts (et environment.prod.ts identique
  pour les clés — les vraies valeurs seront injectées en secrets GitHub Actions)
- Créer SupabaseService, AuthService, AvisService (§3 de la spec)
- Ajouter provideSupabase() dans app.config.ts ? Non : les services sont
  providedIn:'root', pas besoin de provider explicite.

TÂCHE 2 — Modifier CommuneComponent
La fiche passe de 1 vue à 2 onglets (PrimeNG Tabs) :
  - Onglet "Données officielles" : NoteBar existantes (inchangé)
  - Onglet "Avis habitants" : CommuneAvisListComponent + CommuneAvisFormComponent

CommuneAvisListComponent :
- Au init : appelle avisService.loadStats(codeInsee) → affiche note_habitants
  et nb_avis en haut (ou "Aucun avis pour l'instant" si null).
- Liste des avis (pagination : bouton "Voir plus", page++).
- Chaque avis : pseudo + date + note_globale + positifs + negatifs.
- Skeleton de 3 cartes pendant le chargement.

CommuneAvisFormComponent :
- Visible si user() !== null, sinon AuthGateComponent (voir TÂCHE 3).
- 8 sliders PrimeNG (1–10) labellisés avec CRITERE_LABELS.
- Textarea positifs (min 20 chars, compteur de caractères).
- Textarea negatifs (optionnel).
- Submit → avisService.submitAvis() → toast succès/erreur.
- Si l'user a déjà noté cette commune : pre-fill + label "Modifier mon avis".

TÂCHE 3 — AuthGateComponent (shared)
- Props @Input() message = 'Connectez-vous pour donner votre avis'
- Boutons : "Continuer avec Google" (loginWithGoogle) + "Lien magic email"
  (input email + loginWithEmail).
- S'affiche en remplacement du formulaire si !user().

TÂCHE 4 — CritereSlidertComponent (shared)
- @Input() label: string
- @Input() value: number (signal bindé 1–10)
- @Output() valueChange: OutputEmitterRef<number>
- PrimeNG Slider + affiche la valeur avec couleur dynamique ScoreBadge.

Critères d'acceptation :
- Aucune régression sur les tests existants (npm test).
- npm run build sans erreur.
- `npx eslint .` passe.
- inject() uniquement, OnPush partout, zoneless (pas d'effect() inutile).
- Si Supabase est unreachable → état erreur gracieux (pas de crash).
```

---

## §6 — Phase 8 : Carte interactive

### Pipeline — `tools/data-pipeline/src/emit/geo.ts` (nouveau)

```typescript
// Génère public/data/geo-light.json — version allégée pour la carte
// (pas un vrai GeoJSON, trop lourd pour 35k communes)
// Format : { v:1, items: [{i, n, lat, lng, g}] }
// lat/lng depuis geo.api.gouv.fr champs centre.coordinates
// Seules communes avec population >= 500 (réduit à ~25k points)
```

Ajouter dans `npm run data:build` : appel à `emit/geo.ts`.

### Prompt Claude Code

```
Lis CLAUDE.md et docs/SPEC-PHASES-7-12.md §6.

Créer src/app/features/carte/carte.component.ts (standalone, OnPush).

TÂCHE 1 — Chargement lazy de Leaflet
- npm install leaflet @types/leaflet
- Import dynamique dans ngAfterViewInit : const L = await import('leaflet')
- Div #map de hauteur 70vh.
- Tiles OpenStreetMap.

TÂCHE 2 — Données
- httpResource sur 'data/geo-light.json' (même pattern que index.json).
- effect(() => { if (resource.status() === 'resolved') this.renderMarkers() })
  ATTENTION zoneless : utiliser takeUntilDestroyed ou afterNextRender si
  effect ne convient pas.

TÂCHE 3 — Markers
- CircleMarker par commune.
- Couleur : note_globale >= 7.5 → #22c55e, >= 6 → #f59e0b, >= 4 → #ef4444, sinon #6b7280.
- Radius : 5 si pop < 10k, 7 si < 100k, 10 si >= 100k.
- Popup : "<b>{nom}</b><br>{note}/10<br><a href='/plan-ma-ville/ville/{slug}'>Voir la fiche</a>"
- MarkerClusterGroup (leaflet.markercluster) pour le dezoom :
  npm install leaflet.markercluster @types/leaflet.markercluster

TÂCHE 4 — Filtre note minimum
- Signal local `noteMin = signal(0)`.
- Range input HTML natif (0–10 step 0.5) → refiltre les markers affichés.
- Afficher le compte de communes visibles.

Critères d'acceptation :
- Pas de SSR crash (guard typeof window !== 'undefined' ou afterNextRender).
- npm run build sans error.
- La carte affiche des markers sur /carte.
```

---

## §7 — Phase 9 : Résumé IA (Cloudflare Worker)

### Worker (`workers/summarize/src/index.ts`)

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return corsResponse('', 204);

    const url = new URL(request.url);

    // Rate limit par IP (KV)
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const key = `rate:${ip}`;
    const count = parseInt((await env.KV.get(key)) ?? '0');
    if (count >= 10) return corsResponse(JSON.stringify({ error: 'rate_limit' }), 429);
    await env.KV.put(key, String(count + 1), { expirationTtl: 3600 });

    if (url.pathname === '/summarize') {
      const { commune, textes } = await request.json<{ commune: string; textes: string }>();
      const prompt = `Tu es un expert qualité de vie en France. Résume en 2-3 phrases
les avis ci-dessous sur la commune de ${commune}. Style neutre, factuel.
Cite les points forts ET les points faibles. Commence par "Les habitants apprécient".
Avis (max 3000 chars) : ${textes.slice(0, 3000)}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json<{ content: { text: string }[] }>();
      return corsResponse(JSON.stringify({ resume: data.content[0].text }), 200);
    }

    if (url.pathname === '/quiz-match') {
      const { reponses, communes } = await request.json<{ reponses: object; communes: object[] }>();
      const prompt = `Tu es un expert qualité de vie en France.
Profil utilisateur : ${JSON.stringify(reponses)}
Communes disponibles (top 100 avec notes) : ${JSON.stringify(communes)}
Retourne UNIQUEMENT un JSON valide (sans markdown) :
[{"slug":"...","nom":"...","scoreMatch":85,"raison":"courte phrase"}]
Top 5 communes correspondant au profil.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json<{ content: { text: string }[] }>();
      const text = data.content[0].text.replace(/```json|```/g, '').trim();
      return corsResponse(text, 200);
    }

    return corsResponse('Not found', 404);
  },
};

function corsResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': 'https://zikaoinfo.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  });
}

interface Env { CLAUDE_API_KEY: string; KV: KVNamespace; }
```

### Intégration côté fiche commune

```typescript
// commune-ia-summary.component.ts
// Affiché dans l'onglet "Avis habitants" si nb_avis >= 3
// Lazy : généré au clic "Voir le résumé IA"

@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, ... })
export class CommuneIaSummaryComponent {
  @Input() communeNom = '';
  @Input() codeInsee = '';

  readonly #avis = inject(AvisService);
  readonly #claude = inject(ClaudeProxyService);
  readonly #sb = inject(SupabaseService);

  resume = signal<string | null>(null);
  loading = signal(false);
  error = signal(false);

  async generate() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const avis = await this.#avis.loadAvis(this.codeInsee, 0);
      const textes = avis.map(a => `+: ${a.positifs || ''} -: ${a.negatifs || ''}`).join('\n');
      const resume = await this.#claude.summarizeAvis(this.communeNom, textes);
      this.resume.set(resume);
      // Persist en background (best-effort)
      this.#sb.client.from('communes_stats')
        .update({ resume_ia: resume, resume_ia_updated_at: new Date().toISOString() })
        .eq('code_insee', this.codeInsee).then();
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
```

---

## §8 — Phase 10 : Quiz matching IA

### Prompt Claude Code

```
Lis CLAUDE.md et docs/SPEC-PHASES-7-12.md §8.

Créer src/app/features/quiz/quiz.component.ts.

FLOW (signal-driven, 5 étapes) :
- etape = signal(0)
- reponses = signal<Partial<QuizReponses>>({})
- resultat = signal<QuizMatch[] | null>(null)

Étapes :
1. Profil : 4 boutons radio stylisés (famille/jeune actif/télétravailleur/retraité)
2. Priorité 1 : dropdown parmi les 8 CRITERES (label français)
3. Priorité 2 : même dropdown (exclure priorite1)
4. Région : select des 18 régions + "Peu importe"
5. Taille ville : 4 choix

À l'étape 5 → chargement (spinner) → appel claudeProxy.matchQuiz() avec :
- reponses complètes
- top 200 communes depuis classement.json (existant) enrichi de
  communes_stats (note_habitants si dispo) via AvisService

Affichage résultats :
- 5 cartes CommuneCard (nom, région, scoreMatch en %, raison, note globale)
- Lien vers fiche commune pour chaque
- Bouton "Recommencer"

CommuneCardComponent (shared, nouveau) :
- @Input() commune: { slug, nom, departement, global, noteHabitants?, nbAvis? }
- ScoreBadge + note open data + note habitants si dispo
- Lien routerLink vers /ville/:slug

Critères d'acceptation :
- Si workerUrl absent (env dev sans worker) → message "IA indisponible en dev"
- inject() only, OnPush, pas de subscribe() ni async pipe (signals only).
```

---

## §9 — Phase 11 : Comparateur

### Prompt Claude Code

```
Lis CLAUDE.md et docs/SPEC-PHASES-7-12.md.

Créer src/app/features/comparateur/comparateur.component.ts.

ÉTAT :
- villes = signal<CommuneDetail[]>([]) — max 3
- Query params : ?villes=slug1,slug2,slug3 (sync avec router)
  Utiliser ActivatedRoute.queryParams + router.navigate({queryParams}) sans reload.

AJOUT D'UNE VILLE :
- Input autocomplete réutilisant SearchIndexService.search() (existant)
- Au choix → charger CommuneDetail via CommuneDataService (existant)
- Max 3 villes → bouton désactivé si 3 déjà choisies

TABLEAU COMPARATIF :
- Lignes = critères (CRITERE_LABELS) + "Note open data" + "Note habitants" + "Nb avis"
- Colonnes = villes + croix pour retirer
- Cellule avec NoteBar horizontal miniature
- Surligner en vert la meilleure note de chaque ligne

DONNÉES HABITANTS :
- Pour chaque ville : avisService.loadStats(codeInsee)
- Signal computed qui attend les 3 resolves

Critères d'acceptation :
- URL partageable (/comparer?villes=paris-75056,lyon-69123)
- Fonctionne avec 1, 2 ou 3 villes.
- Responsive : tableau scrollable horizontalement sur mobile.
```

---

## §10 — Phase 12 : Profil & villes suivies

### Prompt Claude Code

```
Lis CLAUDE.md et docs/SPEC-PHASES-7-12.md.

Créer src/app/features/profil/profil.component.ts.
Guard : canActivate sur auth.user() !== null (redirect vers '/' si non connecté).

SECTIONS :
1. "Mon profil" : pseudo (éditable via profiles table) + email (readonly)
2. "Mes villes suivies"
   - Charger profiles.villes_suivies (array de code INSEE)
   - Charger note + nom pour chaque via SearchIndexService (chercher par code i)
   - CommuneCardComponent pour chaque ville
   - Bouton retirer (update profiles.villes_suivies)
3. "Mes avis"
   - Charger tous les avis de l'user depuis Supabase
   - Tableau : commune / date / note globale / lien vers fiche

AJOUTER UNE VILLE SUIVIE depuis la fiche commune :
- Bouton cœur dans CommuneComponent (visible si connecté)
- Toggle : ajoute/retire de profiles.villes_suivies
- State optimiste (mise à jour signal avant await)

DÉCONNEXION :
- Bouton "Se déconnecter" → auth.logout() → navigate('/')
```

---

## §11 — Variables d'environnement & secrets CI

### `src/environments/environment.ts`
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  workerUrl: '',  // vide en dev → désactive les features IA
};
```

### `src/environments/environment.prod.ts`
```typescript
// Remplacé à build-time par sed dans CI
export const environment = {
  production: true,
  supabaseUrl: '__SUPABASE_URL__',
  supabaseAnonKey: '__SUPABASE_ANON_KEY__',
  workerUrl: '__WORKER_URL__',
};
```

### `.github/workflows/deploy.yml` — étape build à modifier

```yaml
- name: Inject env
  run: |
    sed -i "s|__SUPABASE_URL__|${{ secrets.SUPABASE_URL }}|g" src/environments/environment.prod.ts
    sed -i "s|__SUPABASE_ANON_KEY__|${{ secrets.SUPABASE_ANON_KEY }}|g" src/environments/environment.prod.ts
    sed -i "s|__WORKER_URL__|${{ secrets.WORKER_URL }}|g" src/environments/environment.prod.ts

- name: Build
  run: npm run build
```

Secrets à ajouter dans GitHub : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WORKER_URL`.

---

## §12 — Classement enrichi (modifier phase 4 existante)

Dans `ClassementComponent` existant, après chargement de `classement.json` :

```typescript
// Charger les stats Supabase en parallèle pour les communes affichées
async enrichWithHabitants(entries: ClassementEntry[]): Promise<ClassementEntryV2[]> {
  const codes = entries.map(e => e.slug.split('-').at(-1)!);  // code INSEE depuis slug
  const { data } = await this.#sb.client
    .from('communes_stats')
    .select('code_insee, note_habitants, nb_avis')
    .in('code_insee', codes);

  const statsMap = new Map(data?.map(d => [d.code_insee, d]) ?? []);
  return entries.map(e => ({
    ...e,
    noteHabitants: statsMap.get(e.slug.split('-').at(-1)!)?.note_habitants ?? null,
    nbAvis: statsMap.get(e.slug.split('-').at(-1)!)?.nb_avis ?? 0,
  }));
}
```

Afficher dans le tableau :
- Colonne "Note open data" (existante)
- Nouvelle colonne "Note habitants" (note_habitants ou "—")
- Nouvelle colonne "Avis" (nbAvis ou 0)

---

## §13 — Checklist par phase

### Phase 7 — Avis
- [ ] `npm install @supabase/supabase-js` sans breaking change
- [ ] Fiche commune : onglets PrimeNG fonctionnels
- [ ] Formulaire notation : submit OK → apparaît dans la liste
- [ ] 1 avis max par user par commune (UNIQUE constraint + UX message)
- [ ] Pas de régression sur `npm test` et `npx eslint .`

### Phase 8 — Carte
- [ ] `/carte` affiche des markers colorés
- [ ] Pas de crash SSR (window guard)
- [ ] `public/data/geo-light.json` généré par `data:build`

### Phase 9 — Résumé IA
- [ ] Worker déployé sur `workers.dev`
- [ ] Rate limiting KV fonctionnel
- [ ] Résumé affiché sur fiche avec ≥ 3 avis
- [ ] CORS configuré pour `zikaoinfo.github.io`

### Phase 10 — Quiz
- [ ] 5 étapes navigables
- [ ] Résultats affichés avec raisons IA
- [ ] Fallback si workerUrl vide

### Phase 11 — Comparateur
- [ ] URL partageable fonctionnelle
- [ ] Tableau responsive

### Phase 12 — Profil
- [ ] Guard auth fonctionne
- [ ] Villes suivies persistées en Supabase
- [ ] Bouton cœur sur fiche commune

---

## §14 — Anti-pièges spécifiques à ce projet

```
// PIÈGE 1 — zoneless : pas d'async pipe, signals uniquement
// ❌ {{ observable$ | async }}
// ✅ {{ mySignal() }}

// PIÈGE 2 — Supabase + zoneless : les callbacks Supabase sont hors zone
// → wrapper dans afterNextRender() ou signal.update() depuis le callback
this.#sb.client.auth.onAuthStateChange((_, session) => {
  // Ce callback est hors zone Angular — OK en zoneless, signal déclenche CD automatiquement
  this.user.set(session?.user ?? null);
});

// PIÈGE 3 — Leaflet en SSG/GitHub Pages
// Toujours : const L = await import('leaflet') dans afterNextRender() ou ngAfterViewInit()
// + vérification typeof window !== 'undefined'

// PIÈGE 4 — baseHref /plan-ma-ville/
// Les URLs Supabase sont absolues (OK), les données JSON sont relatives à baseURI.
// Pour les liens routerLink : '/ville/...' (absolu) ou '../ville/...' (relatif), pas de baseHref préfixe manuel.

// PIÈGE 5 — inject() dans les callbacks async
// ❌ async myMethod() { const sb = inject(SupabaseService) } // crash
// ✅ Injecter au niveau classe avec readonly #sb = inject(SupabaseService)

// PIÈGE 6 — environment en prod
// fileReplacements dans angular.json doit pointer vers environment.prod.ts
// Vérifier que c'est déjà configuré par ng new, sinon ajouter.
```
