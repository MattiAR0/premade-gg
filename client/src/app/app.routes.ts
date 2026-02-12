import { Routes } from '@angular/router';

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
  { path: '**', redirectTo: '' },
];
