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

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getLfgPosts().subscribe({
      next: (posts) => {
        this.posts = posts;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
