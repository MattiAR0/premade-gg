import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Team, STAFF_ROLE_LABELS } from '../../models/team.model';
import { RankBadgeComponent } from '../../shared/rank-badge/rank-badge.component';
import { KarmaBadgeComponent } from '../../shared/karma-badge/karma-badge.component';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [RouterLink, RankBadgeComponent, KarmaBadgeComponent],
  templateUrl: './team-detail.component.html',
  styleUrl: './team-detail.component.scss',
})
export class TeamDetailComponent implements OnInit {
  team: Team | null = null;
  loading = true;
  errorMessage = '';
  actionMessage = '';
  actionError = '';
  actionLoading = false;

  readonly staffLabels = STAFF_ROLE_LABELS;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: ApiService,
    readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.loadTeam(params['id']);
    });
  }

  get isOwner(): boolean {
    return !!this.team && this.auth.isAuthenticated() &&
      this.auth.currentUser()?._id === this.team.owner?._id;
  }

  get isPlayerInTeam(): boolean {
    if (!this.team || !this.auth.isAuthenticated()) return false;
    const userId = this.auth.currentUser()?._id;
    return this.team.players?.some((p) => p.user?._id === userId) || false;
  }

  get regionLabel(): string {
    const map: Record<string, string> = { eu: 'Europa', na: 'Norteamérica', ap: 'Asia Pacífico', kr: 'Corea' };
    return map[this.team?.region || ''] || this.team?.region?.toUpperCase() || '—';
  }

  get teamInitials(): string {
    return this.team?.tag?.substring(0, 3) || this.team?.name?.charAt(0) || '?';
  }

  private loadTeam(id: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.api.getTeamById(id).subscribe({
      next: (team) => {
        this.team = team;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el equipo';
        this.cdr.markForCheck();
      },
    });
  }

  leaveTeam(): void {
    if (!this.team) return;
    const userId = this.auth.currentUser()?._id;
    if (!userId) return;

    this.actionLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.api.removeTeamPlayer(this.team._id, userId).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadTeam(this.team!._id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error al procesar acción';
        this.actionLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  removePlayer(userId: string): void {
    if (!this.team) return;
    this.actionLoading = true;
    this.api.removeTeamPlayer(this.team._id, userId).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadTeam(this.team!._id);
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error';
        this.actionLoading = false;
      },
    });
  }

  removeStaff(userId: string): void {
    if (!this.team) return;
    this.actionLoading = true;
    this.api.removeTeamStaff(this.team._id, userId).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadTeam(this.team!._id);
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error';
        this.actionLoading = false;
      },
    });
  }

  removeCoach(): void {
    if (!this.team) return;
    this.actionLoading = true;
    this.api.setTeamCoach(this.team._id, null).subscribe({
      next: () => {
        this.actionMessage = 'Coach removido';
        this.actionLoading = false;
        this.loadTeam(this.team!._id);
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error';
        this.actionLoading = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/teams']);
  }
}
