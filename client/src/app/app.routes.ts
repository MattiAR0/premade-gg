import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'PremadeGG · Grupos de Valorant con reputación',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'players',
    title: 'Jugadores · PremadeGG',
    loadComponent: () =>
      import('./pages/players/players.component').then((m) => m.PlayersComponent),
  },
  {
    path: 'lfg',
    title: 'Grupos LFG · PremadeGG',
    loadComponent: () =>
      import('./pages/lfg-board/lfg-board.component').then((m) => m.LfgBoardComponent),
  },
  {
    path: 'lfg/:id',
    title: 'Grupo LFG · PremadeGG',
    loadComponent: () =>
      import('./pages/lfg-detail/lfg-detail.component').then((m) => m.LfgDetailComponent),
  },
  {
    path: 'teams',
    title: 'Equipos · PremadeGG',
    loadComponent: () =>
      import('./pages/teams/teams.component').then((m) => m.TeamsComponent),
  },
  {
    path: 'teams/:id',
    title: 'Equipo · PremadeGG',
    loadComponent: () =>
      import('./pages/team-detail/team-detail.component').then((m) => m.TeamDetailComponent),
  },
  {
    path: 'login',
    title: 'Iniciar sesión · PremadeGG',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Crear cuenta · PremadeGG',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    title: 'Recuperar contraseña · PremadeGG',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    title: 'Nueva contraseña · PremadeGG',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'messages',
    title: 'Mensajes · PremadeGG',
    loadComponent: () =>
      import('./pages/messages/messages.component').then((m) => m.MessagesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'messages/:id',
    title: 'Mensajes · PremadeGG',
    loadComponent: () =>
      import('./pages/messages/messages.component').then((m) => m.MessagesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile/:id',
    title: 'Perfil · PremadeGG',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'settings/profile',
    title: 'Editar perfil · PremadeGG',
    loadComponent: () =>
      import('./pages/profile-edit/profile-edit.component').then((m) => m.ProfileEditComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
