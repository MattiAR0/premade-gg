import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PlayersComponent } from './pages/players/players.component';
import { LfgBoardComponent } from './pages/lfg-board/lfg-board.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'players', component: PlayersComponent },
  { path: 'lfg', component: LfgBoardComponent },
  { path: '**', redirectTo: '' },
];
