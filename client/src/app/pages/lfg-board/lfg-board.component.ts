import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
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

  // Paginación interna (infinite scroll)
  private currentPage = 1;
  private totalPages = 1;
  totalPosts = 0;
  readonly pageSize = 3;

  // Filtros
  filterStatus = '';
  filterRole = '';
  statuses = ['open', 'full', 'closed'];
  roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(private readonly api: ApiService) {}

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
    const filters: { role?: string; status?: string; page?: number; limit?: number } = {
      page,
      limit: this.pageSize,
    };
    if (this.filterStatus) filters.status = this.filterStatus;
    if (this.filterRole) filters.role = this.filterRole;

    this.api.getLfgPosts(filters).subscribe({
      next: (res) => {
        this.posts = [...this.posts, ...res.data];
        this.totalPosts = res.total;
        this.totalPages = res.totalPages;
        this.currentPage = res.page;
        this.initialLoading = false;
        this.loadingMore = false;
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar los posts LFG. Comprueba que el servidor está en marcha.';
        console.error('Error loading LFG posts:', err);
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
    this.filterStatus = '';
    this.filterRole = '';
    this.loadPosts();
  }
}
