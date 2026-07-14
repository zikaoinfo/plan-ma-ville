import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'ma ville, notée — la qualité de vie des communes françaises',
  },
  {
    path: 'ville/:slug',
    loadComponent: () => import('./features/commune/commune').then((m) => m.Commune),
    title: 'Commune — ma ville, notée',
  },
  {
    path: 'regions',
    loadComponent: () => import('./features/regions/regions').then((m) => m.Regions),
    title: 'Régions — ma ville, notée',
  },
  {
    path: 'region/:code',
    loadComponent: () => import('./features/region/region').then((m) => m.Region),
    title: 'Région — ma ville, notée',
  },
  {
    path: 'departement/:code',
    loadComponent: () =>
      import('./features/departement/departement').then((m) => m.Departement),
    title: 'Département — ma ville, notée',
  },
  {
    path: 'carte',
    loadComponent: () => import('./features/carte/carte').then((m) => m.Carte),
    title: 'Carte — ma ville, notée',
  },
  {
    path: 'classement',
    loadComponent: () =>
      import('./features/classement/classement').then((m) => m.Classement),
    title: 'Classement — ma ville, notée',
  },
  {
    path: 'palmares/securite/:code',
    loadComponent: () =>
      import('./features/palmares/palmares-departement').then((m) => m.PalmaresDepartement),
    data: { type: 'securite' },
    title: 'Villes les plus sûres — ma ville, notée',
  },
  {
    path: 'palmares/prix/:code',
    loadComponent: () =>
      import('./features/palmares/palmares-departement').then((m) => m.PalmaresDepartement),
    data: { type: 'prix' },
    title: 'Meilleurs prix au m² — ma ville, notée',
  },
  {
    path: 'palmares/autour/:slug',
    loadComponent: () =>
      import('./features/palmares/palmares-autour').then((m) => m.PalmaresAutour),
    title: 'Où vivre autour de… — ma ville, notée',
  },
  {
    path: 'comparer',
    loadComponent: () =>
      import('./features/comparateur/comparateur').then((m) => m.Comparateur),
    title: 'Comparateur — ma ville, notée',
  },
  {
    path: 'methodologie',
    loadComponent: () =>
      import('./features/methodologie/methodologie').then((m) => m.Methodologie),
    title: 'Méthodologie — ma ville, notée',
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
    title: 'Page introuvable — ma ville, notée',
  },
];
