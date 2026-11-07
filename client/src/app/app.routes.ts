import { Routes } from '@angular/router';
import { authGuard, moderatorGuard, onboardingGuard } from './guards/auth.guard';

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
    path: 'onboarding',
    title: 'Vincula tu Riot ID · PremadeGG',
    loadComponent: () =>
      import('./pages/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
    canActivate: [onboardingGuard],
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
  {
    path: 'settings/account',
    title: 'Ajustes de cuenta · PremadeGG',
    loadComponent: () =>
      import('./pages/account-settings/account-settings.component').then((m) => m.AccountSettingsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'privacidad',
    title: 'Política de privacidad · PremadeGG',
    loadComponent: () => import('./pages/legal/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'terminos',
    title: 'Términos de uso · PremadeGG',
    loadComponent: () => import('./pages/legal/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: 'aviso-legal',
    title: 'Aviso legal · PremadeGG',
    loadComponent: () => import('./pages/legal/legal-notice.component').then((m) => m.LegalNoticeComponent),
  },
  {
    path: 'cookies',
    title: 'Política de cookies · PremadeGG',
    loadComponent: () => import('./pages/legal/cookies.component').then((m) => m.CookiesComponent),
  },
  {
    path: 'moderacion',
    title: 'Moderación · PremadeGG',
    loadComponent: () => import('./pages/moderation/moderation.component').then((m) => m.ModerationComponent),
    canActivate: [moderatorGuard],
  },
  {
    path: 'moderacion/decision/:id',
    title: 'Decisión de moderación · PremadeGG',
    loadComponent: () =>
      import('./pages/moderation-decision/moderation-decision.component').then((m) => m.ModerationDecisionComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    title: 'Página no encontrada · PremadeGG',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
