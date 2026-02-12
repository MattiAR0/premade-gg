import { Component, OnInit } from '@angular/core';
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
export class LfgBoardComponent implements OnInit {
  posts: LfgPost[] = [];
  loading = true;
  errorMessage = '';

  // Paginación
  currentPage = 1;
  totalPages = 1;
  totalPosts = 0;
  readonly pageSize = 12;

  // Filtros
  filterStatus = '';
  filterRole = '';
  statuses = ['open', 'full', 'closed'];
  roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters: { role?: string; status?: string; page?: number; limit?: number } = {
      page: this.currentPage,
      limit: this.pageSize,
    };
    if (this.filterStatus) filters.status = this.filterStatus;
    if (this.filterRole) filters.role = this.filterRole;

    this.api.getLfgPosts(filters).subscribe({
      next: (res) => {
        this.posts = res.data;
        this.totalPosts = res.total;
        this.totalPages = res.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar los posts LFG. Comprueba que el servidor está en marcha.';
        console.error('Error loading LFG posts:', err);
        this.loading = false;
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadPosts();
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.filterRole = '';
    this.currentPage = 1;
    this.loadPosts();
  }
}
