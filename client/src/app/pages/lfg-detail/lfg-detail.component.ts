import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LfgPost, LfgMember, TEAM_SIZE_LABELS } from '../../models/lfg-post.model';
import { RankBadgeComponent } from '../../shared/rank-badge/rank-badge.component';
import { KarmaBadgeComponent } from '../../shared/karma-badge/karma-badge.component';
import { LabelPipe } from '../../shared/pipes/label.pipe';

@Component({
  selector: 'app-lfg-detail',
  standalone: true,
  imports: [RouterLink, RankBadgeComponent, KarmaBadgeComponent, LabelPipe],
  templateUrl: './lfg-detail.component.html',
  styleUrl: './lfg-detail.component.scss',
})
export class LfgDetailComponent implements OnInit {
  post: LfgPost | null = null;
  loading = true;
  errorMessage = '';
  actionMessage = '';
  actionError = '';
  actionLoading = false;

  readonly teamLabels = TEAM_SIZE_LABELS;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: ApiService,
    readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.loadPost(params['id']);
    });
  }

  /** URL actual, para volver aquí después de iniciar sesión o registrarse */
  get currentUrl(): string {
    return this.router.url;
  }

  /** Es el creador del post? */
  get isCreator(): boolean {
    return !!this.post && this.auth.isAuthenticated() &&
      this.auth.currentUser()?._id === this.post.author?._id;
  }

  /** Es miembro actual (aceptado o pendiente)? */
  get currentMemberStatus(): 'accepted' | 'pending' | null {
    if (!this.post || !this.auth.isAuthenticated()) return null;
    const userId = this.auth.currentUser()?._id;
    const member = this.post.members?.find((m) => m.user?._id === userId);
    return member?.status || null;
  }

  /** Puede unirse? */
  get canJoin(): boolean {
    return this.auth.isAuthenticated() &&
      !this.isCreator &&
      this.currentMemberStatus === null &&
      this.post?.status === 'open';
  }

  /** Miembros aceptados */
  get acceptedMembers(): LfgMember[] {
    return this.post?.members?.filter((m) => m.status === 'accepted') || [];
  }

  /** Solicitudes pendientes */
  get pendingMembers(): LfgMember[] {
    return this.post?.members?.filter((m) => m.status === 'pending') || [];
  }

  /** Región formateada */
  get regionLabel(): string {
    const map: Record<string, string> = { eu: 'Europa', na: 'Norteamérica', ap: 'Asia Pacífico', kr: 'Corea' };
    return map[this.post?.author?.region || ''] || this.post?.author?.region?.toUpperCase() || '—';
  }

  private loadPost(id: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.api.getLfgPostById(id).subscribe({
      next: (post) => {
        this.post = post;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el post LFG';
        this.cdr.markForCheck();
      },
    });
  }

  /** Solicitar unirse */
  requestJoin(): void {
    if (!this.post) return;
    this.actionLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.api.joinLfgPost(this.post._id).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        // Recargar el post para actualizar miembros
        this.loadPost(this.post!._id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error al enviar solicitud';
        this.actionLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Aceptar o rechazar miembro */
  handleMember(userId: string, action: 'accept' | 'reject'): void {
    if (!this.post) return;
    this.actionLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.api.handleLfgMember(this.post._id, userId, action).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadPost(this.post!._id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error al procesar solicitud';
        this.actionLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Expulsar miembro / abandonar grupo */
  removeMember(userId: string): void {
    if (!this.post) return;
    this.actionLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.api.leaveLfgPost(this.post._id, userId).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadPost(this.post!._id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error al procesar acción';
        this.actionLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Volver al board */
  goBack(): void {
    this.router.navigate(['/lfg']);
  }
}
