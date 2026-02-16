import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { PlayerCardComponent } from '../../shared/player-card/player-card.component';
import { User } from '../../models/user.model';

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
  totalPlayers = 0;
  readonly pageSize = 12;

  // Filtros
  filterRank = '';
  filterRole = '';
  filterMinKarma = 0;
  filterLFT = false;

  ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
  roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadPlayers();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /** Carga la primera página (reset completo) */
  loadPlayers(): void {
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
    this.loadPlayers();
  }
}
