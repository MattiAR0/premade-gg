import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';
import { LfgPost, TeamSizeTab, TEAM_SIZE_LABELS } from '../../models/lfg-post.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-lfg-board',
  standalone: true,
  imports: [FormsModule, LfgCardComponent],
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
  totalPosts = 0;
  readonly pageSize = 12;

  // Tabs por tamaño de equipo
  activeTab: TeamSizeTab = 2;
  readonly tabs: TeamSizeTab[] = [2, 3, 5];
  readonly tabLabels = TEAM_SIZE_LABELS;

  // Filtros
  filterStatus = '';
  statuses = ['open', 'full', 'closed'];

  // ── Crear post ─────────────────────────────────────
  showCreateModal = false;
  creatingPost = false;
  createError = '';
  newPost = {
    title: '',
    description: '',
    teamSize: 2 as 2 | 3 | 5,
    minRank: '',
    minKarma: 3,
  };
  readonly rankOptions = [
    'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum',
    'Diamond', 'Ascendant', 'Immortal', 'Radiant',
  ];
  readonly teamSizeOptions: { value: 2 | 3 | 5; label: string }[] = [
    { value: 2, label: 'Duo (2v2)' },
    { value: 3, label: 'Trio (3v3)' },
    { value: 5, label: '5-Stack (5v5)' },
  ];

  // ── Buscador de miembros ───────────────────────────
  memberSearchQuery = '';
  memberSearchResults: User[] = [];
  selectedMembers: User[] = [];
  searchingMembers = false;
  private memberSearch$ = new Subject<string>();

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadPosts();
    this.setupMemberSearch();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /** Cambia de tab y recarga los posts */
  switchTab(tab: TeamSizeTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.loadPosts();
  }

  /** Carga la primera página (reset completo) */
  loadPosts(): void {
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
    const filters: { teamSize?: number; status?: string; cursor?: string; limit?: number } = {
      limit: this.pageSize,
      teamSize: this.activeTab,
    };
    if (this.nextCursor) filters.cursor = this.nextCursor;
    if (this.filterStatus) filters.status = this.filterStatus;

    this.api.getLfgPosts(filters).subscribe({
      next: (res) => {
        this.posts = [...this.posts, ...res.data];
        if (res.total >= 0) this.totalPosts = res.total;
        this.nextCursor = res.nextCursor;
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();

        this.checkAutoFill();
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar los posts LFG. Comprueba que el servidor está en marcha.';
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

  clearFilters(): void {
    this.filterStatus = '';
    this.loadPosts();
  }

  // ── Create post modal ────────────────────────────────
  openCreateModal(): void {
    this.showCreateModal = true;
    this.createError = '';
    this.newPost = {
      title: '',
      description: '',
      teamSize: this.activeTab,
      minRank: '',
      minKarma: 3,
    };
    this.selectedMembers = [];
    this.memberSearchQuery = '';
    this.memberSearchResults = [];
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  submitNewPost(): void {
    if (!this.newPost.title.trim()) {
      this.createError = 'El título es obligatorio.';
      return;
    }
    this.creatingPost = true;
    this.createError = '';

    const payload: Record<string, unknown> = {
      title: this.newPost.title.trim(),
      teamSize: this.newPost.teamSize,
    };
    if (this.newPost.description.trim()) payload['description'] = this.newPost.description.trim();
    if (this.newPost.minRank) payload['minRank'] = this.newPost.minRank;
    if (this.newPost.minKarma > 0) payload['minKarma'] = this.newPost.minKarma;
    if (this.selectedMembers.length > 0) {
      payload['initialMembers'] = this.selectedMembers.map((u) => u._id);
    }

    this.api.createLfgPost(payload as any).subscribe({
      next: () => {
        this.creatingPost = false;
        this.showCreateModal = false;
        this.loadPosts();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creatingPost = false;
        this.createError = err.error?.message || 'Error al crear el grupo.';
        this.cdr.markForCheck();
      },
    });
  }

  // ── Member search ──────────────────────────────────
  private setupMemberSearch(): void {
    this.memberSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        if (query.length < 2) return of([]);
        this.searchingMembers = true;
        return this.api.searchUsers(query);
      }),
    ).subscribe((users) => {
      const currentUserId = this.auth.currentUser()?._id;
      const selectedIds = new Set(this.selectedMembers.map((u) => u._id));
      this.memberSearchResults = users.filter(
        (u) => u._id !== currentUserId && !selectedIds.has(u._id),
      );
      this.searchingMembers = false;
      this.cdr.markForCheck();
    });
  }

  onMemberSearchInput(): void {
    this.memberSearch$.next(this.memberSearchQuery);
  }

  selectMember(user: User): void {
    const maxExtra = this.newPost.teamSize - 1;
    if (this.selectedMembers.length >= maxExtra) return;
    this.selectedMembers.push(user);
    this.memberSearchQuery = '';
    this.memberSearchResults = [];
  }

  removeMember(user: User): void {
    this.selectedMembers = this.selectedMembers.filter((u) => u._id !== user._id);
  }

  get maxMembers(): number {
    return this.newPost.teamSize - 1;
  }
}
