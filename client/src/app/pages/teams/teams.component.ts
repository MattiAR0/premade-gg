import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { TeamCardComponent } from '../../shared/team-card/team-card.component';
import { UserPickerComponent } from '../../shared/user-picker/user-picker.component';
import { Team } from '../../models/team.model';
import { User, VALORANT_RANKS } from '../../models/user.model';
import { DialogDirective } from '../../shared/dialog/dialog.directive';
import { LabelPipe } from '../../shared/pipes/label.pipe';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [FormsModule, TeamCardComponent, UserPickerComponent, DialogDirective, LabelPipe],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss',
})
export class TeamsComponent implements OnInit, AfterViewInit, OnDestroy {
  teams: Team[] = [];
  initialLoading = true;
  loadingMore = false;
  errorMessage = '';

  private nextCursor: string | null = null;
  // Descarta respuestas de peticiones antiguas cuando los filtros cambian rápido
  private requestId = 0;
  totalTeams = 0;
  readonly pageSize = 12;
  filtersOpen = false;

  // Filtros (sincronizados con la URL: ?q=&region=&rank=&recruiting=1)
  filterRegion = '';
  filterRank = '';
  filterRecruiting = false;
  searchQuery = '';
  private readonly searchInput$ = new Subject<string>();

  readonly regions = ['eu', 'na', 'ap', 'kr'] as const;
  readonly regionLabels: Record<string, string> = {
    eu: 'Europa', na: 'Norteamérica', ap: 'Asia Pacífico', kr: 'Corea',
  };
  readonly ranks = VALORANT_RANKS;

  // ── Crear equipo ──────────────────────────────────────
  showCreateModal = false;
  creatingTeam = false;
  createError = '';
  newTeam = this.emptyTeam();
  /** true cuando el usuario ha escrito el tag a mano (dejamos de autogenerarlo) */
  private tagEdited = false;
  selectedInitialMembers: User[] = [];

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
        if (params.get('create') === '1') {
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
        this.readFilters(params);
        this.loadTeams();
      });

    // La búsqueda por texto se aplica sola tras dejar de escribir
    this.searchInput$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private readFilters(params: ParamMap): void {
    const region = params.get('region') || '';
    const rank = params.get('rank') || '';
    this.filterRegion = (this.regions as readonly string[]).includes(region) ? region : '';
    this.filterRank = (this.ranks as readonly string[]).includes(rank) ? rank : '';
    this.filterRecruiting = params.get('recruiting') === '1';
    // No pisamos lo que se está escribiendo si solo difiere en espacios
    const q = params.get('q') || '';
    if (q !== this.searchQuery.trim()) this.searchQuery = q;
  }

  applyFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.searchQuery.trim() || null,
        region: this.filterRegion || null,
        rank: this.filterRank || null,
        recruiting: this.filterRecruiting ? 1 : null,
      },
      replaceUrl: true,
    });
  }

  onSearchInput(): void {
    this.searchInput$.next(this.searchQuery.trim());
  }

  setRegion(region: string): void {
    this.filterRegion = this.filterRegion === region ? '' : region;
    this.applyFilters();
  }

  toggleRecruiting(): void {
    this.filterRecruiting = !this.filterRecruiting;
    this.applyFilters();
  }

  get activeFilterCount(): number {
    return [this.searchQuery.trim(), this.filterRegion, this.filterRank, this.filterRecruiting].filter(Boolean).length;
  }

  loadTeams(): void {
    this.requestId++;
    this.initialLoading = true;
    this.errorMessage = '';
    this.teams = [];
    this.nextCursor = null;
    this.fetchPage();
  }

  private loadMore(): void {
    if (this.loadingMore || !this.nextCursor) return;
    this.loadingMore = true;
    this.fetchPage();
  }

  private fetchPage(): void {
    const requestId = this.requestId;
    const filters: Record<string, string | number | boolean> = {
      limit: this.pageSize,
    };
    if (this.nextCursor) filters['cursor'] = this.nextCursor;
    if (this.filterRegion) filters['region'] = this.filterRegion;
    if (this.filterRank) filters['targetRank'] = this.filterRank;
    if (this.filterRecruiting) filters['recruiting'] = true;
    if (this.searchQuery.trim()) filters['search'] = this.searchQuery.trim();

    this.api.getTeams(filters).subscribe({
      next: (res) => {
        if (requestId !== this.requestId) return;
        this.teams = [...this.teams, ...res.data];
        if (res.total >= 0) this.totalTeams = res.total;
        this.nextCursor = res.nextCursor;
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
        this.checkAutoFill();
      },
      error: (err) => {
        if (requestId !== this.requestId) return;
        this.errorMessage = 'Error al cargar los equipos.';
        console.error('Error loading teams:', err);
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
    });
  }

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
      if (inViewport) this.loadMore();
    });
  }

  get hasMore(): boolean {
    return this.nextCursor !== null;
  }

  clearFilters(): void {
    this.filterRegion = '';
    this.filterRank = '';
    this.filterRecruiting = false;
    this.searchQuery = '';
    this.applyFilters();
  }

  // ── Create team modal ─────────────────────────────────
  private emptyTeam() {
    return {
      name: '',
      tag: '',
      description: '',
      region: 'eu' as string,
      targetRank: 'Gold' as string,
      recruiting: true,
    };
  }

  openCreateModal(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/teams?create=1' } });
      return;
    }
    // Región y rango por defecto: los del propio usuario
    const user = this.auth.currentUser();
    this.newTeam = {
      ...this.emptyTeam(),
      region: user?.region || 'eu',
      targetRank: user?.rank && (this.ranks as readonly string[]).includes(user.rank) ? user.rank : 'Gold',
    };
    this.tagEdited = false;
    this.selectedInitialMembers = [];
    this.createError = '';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  /** Autogenera el tag a partir de las iniciales del nombre ("Phantom Esports" → "PE") */
  onNameChange(name: string): void {
    this.newTeam.name = name;
    if (this.tagEdited) return;
    const words = name.trim().split(/\s+/).filter(Boolean);
    const tag = words.length > 1
      ? words.map((w) => w[0]).join('')
      : (words[0] || '').slice(0, 3);
    this.newTeam.tag = tag.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
  }

  onTagChange(tag: string): void {
    this.newTeam.tag = tag.toUpperCase();
    this.tagEdited = tag.length > 0;
  }

  submitNewTeam(): void {
    if (!this.newTeam.name.trim()) {
      this.createError = 'Ponle un nombre al equipo.';
      return;
    }
    if (!this.newTeam.tag.trim()) {
      this.createError = 'El tag del equipo es obligatorio.';
      return;
    }
    this.creatingTeam = true;
    this.createError = '';

    const payload: Record<string, unknown> = {
      name: this.newTeam.name.trim(),
      tag: this.newTeam.tag.trim().toUpperCase(),
      region: this.newTeam.region,
      targetRank: this.newTeam.targetRank,
      recruiting: this.newTeam.recruiting,
    };
    if (this.newTeam.description.trim()) {
      payload['description'] = this.newTeam.description.trim();
    }
    if (this.selectedInitialMembers.length > 0) {
      payload['initialPlayers'] = this.selectedInitialMembers.map((u) => u._id);
    }

    this.api.createTeam(payload as Partial<Team>).subscribe({
      next: (team) => {
        this.creatingTeam = false;
        this.showCreateModal = false;
        this.cdr.markForCheck();
        this.router.navigate(['/teams', team._id]);
      },
      error: (err) => {
        this.creatingTeam = false;
        this.createError = err.error?.message || 'Error al crear el equipo.';
        this.cdr.markForCheck();
      },
    });
  }
}
