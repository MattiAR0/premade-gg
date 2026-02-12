import { Component, OnInit } from '@angular/core';
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
export class PlayersComponent implements OnInit {
  players: User[] = [];
  loading = true;

  // Paginación
  currentPage = 1;
  totalPages = 1;
  totalPlayers = 0;
  readonly pageSize = 12;

  // Filtros
  filterRank = '';
  filterRole = '';
  filterMinKarma = 0;

  ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
  roles = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.loadPlayers();
  }

  loadPlayers(): void {
    this.loading = true;
    const filters: { rank?: string; role?: string; minKarma?: number; page?: number; limit?: number } = {
      page: this.currentPage,
      limit: this.pageSize,
    };
    if (this.filterRank) filters.rank = this.filterRank;
    if (this.filterRole) filters.role = this.filterRole;
    if (this.filterMinKarma > 0) filters.minKarma = this.filterMinKarma;

    this.api.getUsers(filters).subscribe({
      next: (res) => {
        this.players = res.data;
        this.totalPlayers = res.total;
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
    this.loadPlayers();
  }

  clearFilters(): void {
    this.filterRank = '';
    this.filterRole = '';
    this.filterMinKarma = 0;
    this.currentPage = 1;
    this.loadPlayers();
  }
}
