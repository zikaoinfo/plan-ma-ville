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
    path: 'departement/:code',
    loadComponent: () =>
      import('./features/departement/departement').then((m) => m.Departement),
    title: 'Département — Ma ville, notée',
  },
  {
    path: 'classement',
    loadComponent: () =>
      import('./features/classement/classement').then((m) => m.Classement),
    title: 'Classement — Ma ville, notée',
  },
  {
    path: 'methodologie',
    loadComponent: () =>
      import('./features/methodologie/methodologie').then((m) => m.Methodologie),
    title: 'Méthodologie — Ma ville, notée',
  },
  { path: '**', redirectTo: '' },
];
