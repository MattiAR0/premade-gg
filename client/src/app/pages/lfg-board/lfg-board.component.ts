import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { LfgCardComponent } from '../../shared/lfg-card/lfg-card.component';
import { LfgPost } from '../../models/lfg-post.model';

@Component({
  selector: 'app-lfg-board',
  standalone: true,
  imports: [LfgCardComponent],
  templateUrl: './lfg-board.component.html',
  styleUrl: './lfg-board.component.scss',
})
export class LfgBoardComponent implements OnInit {
  posts: LfgPost[] = [];
  loading = true;

  // Paginación
  currentPage = 1;
  totalPages = 1;
  totalPosts = 0;
  readonly pageSize = 12;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.loading = true;
    this.api.getLfgPosts({ page: this.currentPage, limit: this.pageSize }).subscribe({
      next: (res) => {
        this.posts = res.data;
        this.totalPosts = res.total;
        this.totalPages = res.totalPages;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadPosts();
  }
}
