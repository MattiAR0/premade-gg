import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';
import { LfgPost } from '../../models/lfg-post.model';

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

  // Filtros
  filterStatus = '';
  filterRole = '';
  statuses = ['open', 'full', 'closed'];
  roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
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
    const filters: { role?: string; status?: string; cursor?: string; limit?: number } = {
      limit: this.pageSize,
    };
    if (this.nextCursor) filters.cursor = this.nextCursor;
    if (this.filterStatus) filters.status = this.filterStatus;
    if (this.filterRole) filters.role = this.filterRole;

    this.api.getLfgPosts(filters).subscribe({
      next: (res) => {
        this.posts = [...this.posts, ...res.data];
        if (res.total >= 0) this.totalPosts = res.total;
        this.nextCursor = res.nextCursor;
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();

        // Auto-fill: si el sentinel sigue visible tras cargar, pedimos más datos.
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
   * Si lo está y quedan datos, carga la siguiente.
   */
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
    this.filterRole = '';
    this.loadPosts();
  }
}
