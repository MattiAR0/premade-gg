import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';
import { UserPickerComponent } from '../../shared/user-picker/user-picker.component';
import { LfgPost, TeamSizeTab, TEAM_SIZE_LABELS } from '../../models/lfg-post.model';
import { User, VALORANT_RANKS } from '../../models/user.model';

type LfgStatus = 'open' | 'full' | 'closed';

@Component({
  selector: 'app-lfg-board',
  standalone: true,
  imports: [FormsModule, LfgCardComponent, UserPickerComponent],
  templateUrl: './lfg-board.component.html',
  styleUrl: './lfg-board.component.scss',
})
export class LfgBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  posts: LfgPost[] = [];
  initialLoading = true;
  loadingMore = false;
  errorMessage = '';

  // Paginación cursor-based (infinite scroll)
  private nextCursor: string | null = null;
  // Descarta respuestas de peticiones antiguas cuando los filtros cambian rápido
  private requestId = 0;
  totalPosts = 0;
  readonly pageSize = 12;

  // Filtros (sincronizados con la URL: ?size=2|3|5&status=open|full|closed)
  activeSize: TeamSizeTab | null = null;
  activeStatus: LfgStatus = 'open';
  readonly sizes: TeamSizeTab[] = [2, 3, 5];
  readonly sizeLabels = TEAM_SIZE_LABELS;
  readonly statusOptions: { value: LfgStatus; label: string }[] = [
    { value: 'open', label: 'Abiertos' },
    { value: 'full', label: 'Llenos' },
    { value: 'closed', label: 'Cerrados' },
  ];

  // ── Crear post ─────────────────────────────────────
  showCreateModal = false;
  creatingPost = false;
  createError = '';
  newPost = this.emptyPost();
  selectedMembers: User[] = [];
  readonly rankOptions = VALORANT_RANKS;
  readonly karmaOptions = [
    { value: 0, label: 'Sin mínimo' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
  ];

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        // ?create=1 abre el formulario (desde navbar / home) y se limpia de la URL
        if (params.get('create') === '1') {
          // Al recargar con ?create=1 la sesión puede no estar restaurada aún
          this.auth.whenSessionRestored.then(() => {
            this.openCreateModal();
            this.cdr.markForCheck();
          });
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { create: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          return;
        }

        const changed = this.readFilters(params);
        if (changed || this.posts.length === 0) this.loadPosts();
      });
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /** Lee los filtros de la URL. Devuelve true si han cambiado. */
  private readFilters(params: ParamMap): boolean {
    const size = Number(params.get('size'));
    const status = params.get('status') as LfgStatus;
    const nextSize = this.sizes.includes(size as TeamSizeTab) ? (size as TeamSizeTab) : null;
    const nextStatus = this.statusOptions.some((o) => o.value === status) ? status : 'open';
    const changed = nextSize !== this.activeSize || nextStatus !== this.activeStatus;
    this.activeSize = nextSize;
    this.activeStatus = nextStatus;
    return changed;
  }

  private applyFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: this.activeSize,
        status: this.activeStatus === 'open' ? null : this.activeStatus,
      },
      replaceUrl: true,
    });
  }

  setSize(size: TeamSizeTab | null): void {
    if (size === this.activeSize) return;
    this.activeSize = size;
    this.applyFilters();
  }

  setStatus(status: LfgStatus): void {
    if (status === this.activeStatus) return;
    this.activeStatus = status;
    this.applyFilters();
  }

  get resultsLabel(): string {
    const type = this.activeSize ? `de ${this.sizeLabels[this.activeSize]}` : '';
    const status = this.statusOptions.find((o) => o.value === this.activeStatus)!.label.toLowerCase();
    return `grupos ${type} ${status}`.replace(/\s+/g, ' ').trim();
  }

  /** Carga la primera página (reset completo) */
  loadPosts(): void {
    this.requestId++;
    this.initialLoading = true;
    this.errorMessage = '';
    this.posts = [];
    this.nextCursor = null;

    this.fetchPage();
  }

  /** Carga la siguiente página (append) */
  private loadMore(): void {
    if (this.loadingMore || !this.nextCursor) return;
    this.loadingMore = true;
    this.fetchPage();
  }

  /** Petición genérica de una página */
  private fetchPage(): void {
    const requestId = this.requestId;
    const filters: { teamSize?: number; status?: string; cursor?: string; limit?: number } = {
      limit: this.pageSize,
      status: this.activeStatus,
    };
    if (this.activeSize) filters.teamSize = this.activeSize;
    if (this.nextCursor) filters.cursor = this.nextCursor;

    this.api.getLfgPosts(filters).subscribe({
      next: (res) => {
        if (requestId !== this.requestId) return;
        this.posts = [...this.posts, ...res.data];
        if (res.total >= 0) this.totalPosts = res.total;
        this.nextCursor = res.nextCursor;
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();

        this.checkAutoFill();
      },
      error: (err) => {
        if (requestId !== this.requestId) return;
        this.errorMessage = 'Error al cargar los grupos. Comprueba que el servidor está en marcha.';
        console.error('Error loading LFG posts:', err);
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Configura el IntersectionObserver para infinite scroll */
  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.initialLoading) {
          this.loadMore();
          this.cdr.markForCheck();
        }
      },
      { rootMargin: '200px' },
    );

    if (this.scrollSentinel) {
      this.observer.observe(this.scrollSentinel.nativeElement);
    }
  }

  private checkAutoFill(): void {
    if (!this.scrollSentinel || !this.nextCursor) return;

    setTimeout(() => {
      const rect = this.scrollSentinel.nativeElement.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight + 200;
      if (inViewport) {
        this.loadMore();
      }
    });
  }

  get hasMore(): boolean {
    return this.nextCursor !== null;
  }

  // ── Create post modal ────────────────────────────────
  private emptyPost() {
    return {
      title: '',
      description: '',
      teamSize: 2 as TeamSizeTab,
      minRank: '',
      minKarma: 3,
    };
  }

  openCreateModal(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/lfg?create=1' } });
      return;
    }
    this.createError = '';
    this.newPost = { ...this.emptyPost(), teamSize: this.activeSize ?? 2 };
    this.selectedMembers = [];
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  setNewPostSize(size: TeamSizeTab): void {
    this.newPost.teamSize = size;
    // Si reduce el tamaño, recorta los miembros que ya no caben
    this.selectedMembers = this.selectedMembers.slice(0, size - 1);
  }

  /** Título por defecto si el usuario no escribe uno: "Duo · Gold · Duelist" */
  get suggestedTitle(): string {
    const user = this.auth.currentUser();
    const parts: string[] = [`Busco ${this.sizeLabels[this.newPost.teamSize]}`];
    if (user?.rank) parts.push(user.rank);
    if (user?.role) parts.push(user.role);
    return parts.join(' · ');
  }

  get maxMembers(): number {
    return this.newPost.teamSize - 1;
  }

  submitNewPost(): void {
    this.creatingPost = true;
    this.createError = '';

    const payload: {
      title: string;
      teamSize: number;
      description?: string;
      minRank?: string;
      minKarma?: number;
      initialMembers?: string[];
    } = {
      title: this.newPost.title.trim() || this.suggestedTitle,
      teamSize: this.newPost.teamSize,
    };
    if (this.newPost.description.trim()) payload.description = this.newPost.description.trim();
    if (this.newPost.minRank) payload.minRank = this.newPost.minRank;
    payload.minKarma = this.newPost.minKarma;
    if (this.selectedMembers.length > 0) {
      payload.initialMembers = this.selectedMembers.map((u) => u._id);
    }

    this.api.createLfgPost(payload).subscribe({
      next: (post) => {
        this.creatingPost = false;
        this.showCreateModal = false;
        this.cdr.markForCheck();
        this.router.navigate(['/lfg', post._id]);
      },
      error: (err) => {
        this.creatingPost = false;
        this.createError = err.error?.message || 'Error al crear el grupo.';
        this.cdr.markForCheck();
      },
    });
  }
}
