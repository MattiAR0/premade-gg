import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
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

  // Paginación interna (infinite scroll)
  private currentPage = 1;
  private totalPages = 1;
  totalPlayers = 0;
  readonly pageSize = 3;

  // Filtros
  filterRank = '';
  filterRole = '';
  filterMinKarma = 0;

  ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
  roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(private readonly api: ApiService) {}

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
    this.currentPage = 1;

    this.fetchPage(1);
  }

  /** Carga la siguiente página (append) */
  private loadMore(): void {
    if (this.loadingMore || this.currentPage >= this.totalPages) return;
    this.loadingMore = true;
    this.fetchPage(this.currentPage + 1);
  }

  /** Petición genérica de una página */
  private fetchPage(page: number): void {
    const filters: { rank?: string; role?: string; minKarma?: number; page?: number; limit?: number } = {
      page,
      limit: this.pageSize,
    };
    if (this.filterRank) filters.rank = this.filterRank;
    if (this.filterRole) filters.role = this.filterRole;
    if (this.filterMinKarma > 0) filters.minKarma = this.filterMinKarma;

    this.api.getUsers(filters).subscribe({
      next: (res) => {
        this.players = [...this.players, ...res.data];
        this.totalPlayers = res.total;
        this.totalPages = res.totalPages;
        this.currentPage = res.page;
        this.initialLoading = false;
        this.loadingMore = false;
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar jugadores. Comprueba que el servidor está en marcha.';
        console.error('Error loading players:', err);
        this.initialLoading = false;
        this.loadingMore = false;
      },
    });
  }

  /** Configura el IntersectionObserver para infinite scroll */
  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.initialLoading) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    if (this.scrollSentinel) {
      this.observer.observe(this.scrollSentinel.nativeElement);
    }
  }

  get hasMore(): boolean {
    return this.currentPage < this.totalPages;
  }

  clearFilters(): void {
    this.filterRank = '';
    this.filterRole = '';
    this.filterMinKarma = 0;
    this.loadPlayers();
  }
}
