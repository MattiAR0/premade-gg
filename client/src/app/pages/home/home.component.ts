import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PlayerCardComponent } from '../../shared/player-card/player-card.component';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';
import { TeamCardComponent } from '../../shared/team-card/team-card.component';
import { User, VALORANT_ROLES, VALORANT_RANKS } from '../../models/user.model';
import { LfgPost, TeamSizeTab, TEAM_SIZE_LABELS } from '../../models/lfg-post.model';
import { Team } from '../../models/team.model';
import { LabelPipe } from '../../shared/pipes/label.pipe';

type FinderMode = 'lfg' | 'players';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule, PlayerCardComponent, LfgCardComponent, TeamCardComponent, LabelPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  topPlayers: User[] = [];
  openPosts: LfgPost[] = [];
  recruitingTeams: Team[] = [];

  totalPlayers = 0;
  totalOpenPosts = 0;
  totalRecruiting = 0;

  loading = true;
  errorMessage = '';

  // ── Buscador rápido (hero) ─────────────────────────
  finderMode: FinderMode = 'lfg';
  finderRole = '';
  finderRank = '';
  finderSize: TeamSizeTab | null = null;

  readonly roles = VALORANT_ROLES;
  readonly ranks = VALORANT_RANKS;
  readonly sizes: TeamSizeTab[] = [2, 3, 5];
  readonly sizeLabels = TEAM_SIZE_LABELS;

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    // Peticiones independientes: cada sección se pinta en cuanto llega su dato.
    let pending = 4;
    const done = () => {
      pending--;
      if (pending === 0) this.loading = false;
      this.cdr.markForCheck();
    };
    const fail = (err: unknown) => {
      this.errorMessage = 'No se pudo conectar con el servidor.';
      console.error('Error loading home data:', err);
      done();
    };

    this.api.getLfgPosts({ limit: 4 }).subscribe({
      next: (res) => {
        this.openPosts = res.data;
        this.totalOpenPosts = res.total;
        done();
      },
      error: fail,
    });

    // Top jugadores: solo quien tiene valoraciones. El servidor ordena por karma ajustado,
    // así que un 4,7 con 3 valoraciones va por delante de un 5,0 con una.
    this.api.getUsers({ minReviews: 1, limit: 3 }).subscribe({
      next: (res) => {
        this.topPlayers = res.data;
        done();
      },
      error: fail,
    });

    // Total de jugadores para las cifras del hero
    this.api.getUsers({ limit: 1 }).subscribe({
      next: (res) => {
        this.totalPlayers = res.total;
        done();
      },
      error: fail,
    });

    this.api.getTeams({ recruiting: true, limit: 3 }).subscribe({
      next: (res) => {
        this.recruitingTeams = res.data;
        this.totalRecruiting = res.total;
        done();
      },
      error: fail,
    });
  }

  setFinderMode(mode: FinderMode): void {
    this.finderMode = mode;
  }

  toggleFinderRole(role: string): void {
    this.finderRole = this.finderRole === role ? '' : role;
  }

  /** Lleva al listado correspondiente con los filtros del buscador como query params */
  search(): void {
    if (this.finderMode === 'players') {
      const queryParams: Record<string, string> = {};
      if (this.finderRole) queryParams['role'] = this.finderRole;
      if (this.finderRank) queryParams['rank'] = this.finderRank;
      this.router.navigate(['/players'], { queryParams });
    } else {
      const queryParams: Record<string, string | number> = {};
      if (this.finderSize) queryParams['size'] = this.finderSize;
      this.router.navigate(['/lfg'], { queryParams });
    }
  }

  /** Publicar grupo: si no hay sesión, pasa por login y vuelve al formulario */
  createGroup(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/lfg'], { queryParams: { create: 1 } });
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/lfg?create=1' } });
    }
  }
}
