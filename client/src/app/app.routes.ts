import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'players',
    loadComponent: () =>
      import('./pages/players/players.component').then((m) => m.PlayersComponent),
  },
  {
    path: 'lfg',
    loadComponent: () =>
      import('./pages/lfg-board/lfg-board.component').then((m) => m.LfgBoardComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'profile/:id',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'settings/profile',
    loadComponent: () =>
      import('./pages/profile-edit/profile-edit.component').then((m) => m.ProfileEditComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
