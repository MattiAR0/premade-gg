import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LfgPost, LfgMember, TEAM_SIZE_LABELS } from '../../models/lfg-post.model';
import { VALORANT_RANKS } from '../../models/user.model';
import { RankBadgeComponent } from '../../shared/rank-badge/rank-badge.component';
import { KarmaBadgeComponent } from '../../shared/karma-badge/karma-badge.component';
import { LabelPipe } from '../../shared/pipes/label.pipe';
import { DialogDirective } from '../../shared/dialog/dialog.directive';

@Component({
  selector: 'app-lfg-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, RankBadgeComponent, KarmaBadgeComponent, LabelPipe, DecimalPipe, DialogDirective],
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
  /** Dónde se muestra el resultado: junto a "Solicitar unirse" o junto a la lista de miembros */
  feedbackAt: 'join' | 'members' = 'join';

  readonly teamLabels = TEAM_SIZE_LABELS;
  readonly rankOptions = VALORANT_RANKS;
  /** Mismas opciones que al crear el grupo */
  readonly karmaOptions = [
    { value: 0, label: 'Sin mínimo' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
  ];

  // ── Editar y borrar (solo el creador) ─────────────
  showEditModal = false;
  editForm = { title: '', description: '', minRank: '', minKarma: 0 };
  editError = '';
  editSaving = false;
  showDeleteModal = false;
  deleteError = '';
  deleting = false;
  private readonly title = inject(Title);

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

  /** Quien todavía puede pedir unirse: con sesión, sin ser creador ni miembro */
  get isCandidate(): boolean {
    return this.auth.isAuthenticated() && !this.isCreator && this.currentMemberStatus === null;
  }

  /**
   * Karma ajustado del usuario (el que comprueba el servidor). Si el perfil en memoria
   * aún no trae trustKarma, se calcula igual que la columna generada: (3·3,5 + karma·n) / (3 + n).
   */
  get myTrustKarma(): number {
    const me = this.auth.currentUser();
    if (!me) return 0;
    if (me.trustKarma != null) return me.trustKarma;
    const n = me.reviewCount ?? 0;
    return Math.round(((3 * 3.5 + me.karma * n) / (3 + n)) * 100) / 100;
  }

  get meetsKarma(): boolean {
    return !!this.post && this.myTrustKarma >= this.post.minKarma;
  }

  get meetsRank(): boolean {
    const minRank = this.post?.minRank;
    if (!minRank) return true;
    const ranks = VALORANT_RANKS as readonly string[];
    return ranks.indexOf(this.auth.currentUser()?.rank ?? '') >= ranks.indexOf(minRank);
  }

  /** Qué le falta para poder unirse, en una frase; vacío si cumple todo */
  get joinBlockReason(): string {
    if (!this.post) return '';
    const missing: string[] = [];
    if (!this.meetsRank) missing.push('rango');
    if (!this.meetsKarma) missing.push('karma');
    if (!missing.length) return '';
    const karmaHint = this.meetsKarma ? '' : ' El karma sube con las valoraciones de tus compañeros.';
    return `Te falta ${missing.join(' y ')} para unirte a este grupo.${karmaHint}`;
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

  /**
   * silent: refresca sin volver al esqueleto (tras una acción), para no perder
   * el sitio ni el foco. focusStatus: al terminar, el foco va al mensaje de estado.
   */
  private loadPost(id: string, silent = false, focusStatus = false): void {
    if (!silent) this.loading = true;
    this.errorMessage = '';

    this.api.getLfgPostById(id).subscribe({
      next: (post) => {
        this.post = post;
        this.title.setTitle(`${post.title} · PremadeGG`);
        this.loading = false;
        this.cdr.markForCheck();
        if (focusStatus) setTimeout(() => document.getElementById('lfg-join-status')?.focus());
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar el grupo';
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
    this.feedbackAt = 'join';

    this.api.joinLfgPost(this.post._id).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        // Refresca miembros sin esqueleto y lleva el foco al nuevo estado ("pendiente")
        this.loadPost(this.post!._id, true, true);
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
    this.feedbackAt = 'members';

    this.api.handleLfgMember(this.post._id, userId, action).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadPost(this.post!._id, true);
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
    this.feedbackAt = 'members';

    this.api.leaveLfgPost(this.post._id, userId).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.actionLoading = false;
        this.loadPost(this.post!._id, true);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err.error?.message || 'Error al procesar acción';
        this.actionLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openEditModal(): void {
    if (!this.post) return;
    this.editForm = {
      title: this.post.title,
      description: this.post.description ?? '',
      minRank: this.post.minRank ?? '',
      minKarma: this.post.minKarma ?? 0,
    };
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    if (this.editSaving) return;
    this.showEditModal = false;
  }

  saveEdit(): void {
    if (!this.post) return;
    const title = this.editForm.title.trim();
    if (!title) {
      this.editError = 'El título no puede estar vacío';
      return;
    }
    this.editSaving = true;
    this.editError = '';
    this.api
      .updateLfgPost(this.post._id, {
        title,
        description: this.editForm.description.trim(),
        minRank: this.editForm.minRank,
        minKarma: this.editForm.minKarma,
      })
      .subscribe({
        next: (post) => {
          this.post = post;
          this.title.setTitle(`${post.title} · PremadeGG`);
          this.editSaving = false;
          this.showEditModal = false;
          this.feedbackAt = 'join';
          this.actionError = '';
          this.actionMessage = 'Grupo actualizado';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.editSaving = false;
          this.editError = err.error?.message || 'No se pudo guardar el grupo';
          this.cdr.markForCheck();
        },
      });
  }

  /** Cerrar deja de aceptar solicitudes; reabrir vuelve a "abierto" (o "lleno" si no quedan plazas) */
  toggleClosed(): void {
    if (!this.post) return;
    const status = this.post.status === 'closed' ? 'open' : 'closed';
    this.actionLoading = true;
    this.actionMessage = '';
    this.actionError = '';
    this.feedbackAt = 'join';
    this.api.updateLfgPost(this.post._id, { status }).subscribe({
      next: (post) => {
        this.post = post;
        this.actionLoading = false;
        this.actionMessage = status === 'closed' ? 'Grupo cerrado: ya no acepta solicitudes' : 'Grupo reabierto';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionLoading = false;
        this.actionError = err.error?.message || 'No se pudo cambiar el estado del grupo';
        this.cdr.markForCheck();
      },
    });
  }

  openDeleteModal(): void {
    this.deleteError = '';
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    if (this.deleting) return;
    this.showDeleteModal = false;
  }

  deleteGroup(): void {
    if (!this.post) return;
    this.deleting = true;
    this.deleteError = '';
    this.api.deleteLfgPost(this.post._id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.router.navigate(['/lfg']);
      },
      error: (err) => {
        this.deleting = false;
        this.deleteError = err.error?.message || 'No se pudo eliminar el grupo';
        this.cdr.markForCheck();
      },
    });
  }

  /** Volver al board */
  goBack(): void {
    this.router.navigate(['/lfg']);
  }
}
