import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'Ma ville, notée',
  },
  {
    path: 'ville/:slug',
    loadComponent: () => import('./features/commune/commune').then((m) => m.Commune),
    title: 'Commune — Ma ville, notée',
  },
  {
    path: 'regions',
    loadComponent: () => import('./features/regions/regions').then((m) => m.Regions),
    title: 'Régions — Ma ville, notée',
  },
  {
    path: 'region/:code',
    loadComponent: () => import('./features/region/region').then((m) => m.Region),
    title: 'Région — Ma ville, notée',
  },
  {
    path: 'departement/:code',
    loadComponent: () =>
      import('./features/departement/departement').then((m) => m.Departement),
    title: 'Département — Ma ville, notée',
  },
  {
    path: 'carte',
    loadComponent: () => import('./features/carte/carte').then((m) => m.Carte),
    title: 'Carte — Ma ville, notée',
  },
  {
    path: 'classement',
    loadComponent: () =>
      import('./features/classement/classement').then((m) => m.Classement),
    title: 'Classement — Ma ville, notée',
  },
  {
    path: 'comparer',
    loadComponent: () =>
      import('./features/comparateur/comparateur').then((m) => m.Comparateur),
    title: 'Comparateur — Ma ville, notée',
  },
  {
    path: 'methodologie',
    loadComponent: () =>
      import('./features/methodologie/methodologie').then((m) => m.Methodologie),
    title: 'Méthodologie — Ma ville, notée',
  },
  { path: '**', redirectTo: '' },
];
