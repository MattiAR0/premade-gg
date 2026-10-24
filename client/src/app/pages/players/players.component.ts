import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { PlayerCardComponent } from '../../shared/player-card/player-card.component';
import { User, VALORANT_RANKS, VALORANT_ROLES } from '../../models/user.model';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [FormsModule, PlayerCardComponent],
  templateUrl: './players.component.html',
  styleUrl: './players.component.scss',
})
export class PlayersComponent implements OnInit, AfterViewInit, OnDestroy {
  players: User[] = [];
  initialLoading = true;
  loadingMore = false;
  errorMessage = '';

  // Paginación cursor-based (infinite scroll)
  private nextCursor: string | null = null;
  // Descarta respuestas de peticiones antiguas cuando los filtros cambian rápido
  private requestId = 0;
  totalPlayers = 0;
  readonly pageSize = 12;

  // Filtros (sincronizados con la URL: ?rank=&role=&karma=&lft=1)
  filterRank = '';
  filterRole = '';
  filterMinKarma = 0;
  filterLFT = false;

  readonly ranks = VALORANT_RANKS;
  readonly roles = VALORANT_ROLES;
  readonly karmaOptions = [
    { value: 0, label: 'Cualquiera' },
    { value: 3, label: '3+' },
    { value: 4, label: '4+' },
    { value: 4.5, label: '4.5+' },
  ];

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    // La URL es la fuente de verdad: cada cambio de filtro navega y esto recarga.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.readFilters(params);
        this.loadPlayers();
      });
  }

  private readFilters(params: ParamMap): void {
    const rank = params.get('rank') || '';
    const role = params.get('role') || '';
    const karma = Number(params.get('karma'));
    this.filterRank = (this.ranks as readonly string[]).includes(rank) ? rank : '';
    this.filterRole = (this.roles as readonly string[]).includes(role) ? role : '';
    this.filterMinKarma = karma > 0 && karma <= 5 ? karma : 0;
    this.filterLFT = params.get('lft') === '1';
  }

  /** Vuelca los filtros actuales a la URL (dispara la recarga) */
  applyFilters(): void {
    const queryParams: Record<string, string | number | null> = {
      rank: this.filterRank || null,
      role: this.filterRole || null,
      karma: this.filterMinKarma || null,
      lft: this.filterLFT ? 1 : null,
    };
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  setRole(role: string): void {
    this.filterRole = this.filterRole === role ? '' : role;
    this.applyFilters();
  }

  setMinKarma(value: number): void {
    this.filterMinKarma = value;
    this.applyFilters();
  }

  toggleLFT(): void {
    this.filterLFT = !this.filterLFT;
    this.applyFilters();
  }

  get activeFilterCount(): number {
    return [this.filterRank, this.filterRole, this.filterMinKarma, this.filterLFT].filter(Boolean).length;
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /** Carga la primera página (reset completo) */
  loadPlayers(): void {
    this.requestId++;
    this.initialLoading = true;
    this.errorMessage = '';
    this.players = [];
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
    const filters: { rank?: string; role?: string; minKarma?: number; lookingForTeam?: boolean; cursor?: string; limit?: number } = {
      limit: this.pageSize,
    };
    if (this.nextCursor) filters.cursor = this.nextCursor;
    if (this.filterRank) filters.rank = this.filterRank;
    if (this.filterRole) filters.role = this.filterRole;
    if (this.filterMinKarma > 0) filters.minKarma = this.filterMinKarma;
    if (this.filterLFT) filters.lookingForTeam = true;

    this.api.getUsers(filters).subscribe({
      next: (res) => {
        if (requestId !== this.requestId) return;
        this.players = [...this.players, ...res.data];
        // El backend solo envía total en la primera página (-1 = sin cambios)
        if (res.total >= 0) this.totalPlayers = res.total;
        this.nextCursor = res.nextCursor;
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();

        // Auto-fill: si el sentinel sigue visible tras cargar, pedimos más datos.
        // Resuelve el bug donde el IntersectionObserver no re-dispara porque
        // el sentinel nunca salió del viewport (no hubo cambio de estado).
        this.checkAutoFill();
      },
      error: (err) => {
        if (requestId !== this.requestId) return;
        this.errorMessage = 'Error al cargar jugadores. Comprueba que el servidor está en marcha.';
        console.error('Error loading players:', err);
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Configura el IntersectionObserver para infinite scroll */
  private setupIntersectionObserver(): void {
    // IntersectionObserver ejecuta su callback fuera de la zona de Angular.
    // En modo zoneless (Angular 21 sin zone.js), necesitamos notificar a Angular
    // manualmente para que detecte los cambios tras cargar más datos.
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

  /**
   * Comprueba si el sentinel sigue visible después de renderizar nuevos items.
   * Si lo está y quedan datos, carga la siguiente. Esto evita que el
   * infinite scroll se "atasque" cuando el contenido no llena el viewport.
   */
  private checkAutoFill(): void {
    if (!this.scrollSentinel || !this.nextCursor) return;

    // Esperamos un tick para que Angular renderice los nuevos items
    setTimeout(() => {
      const rect = this.scrollSentinel.nativeElement.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight + 200; // mismo margen que el observer
      if (inViewport) {
        this.loadMore();
      }
    });
  }

  get hasMore(): boolean {
    return this.nextCursor !== null;
  }

  clearFilters(): void {
    this.filterRank = '';
    this.filterRole = '';
    this.filterMinKarma = 0;
    this.filterLFT = false;
    this.applyFilters();
  }
}
