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
    const filters: { rank?: string; role?: string; minKarma?: number } = {};
    if (this.filterRank) filters.rank = this.filterRank;
    if (this.filterRole) filters.role = this.filterRole;
    if (this.filterMinKarma > 0) filters.minKarma = this.filterMinKarma;

    this.api.getUsers(filters).subscribe({
      next: (users) => {
        this.players = users;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  clearFilters(): void {
    this.filterRank = '';
    this.filterRole = '';
    this.filterMinKarma = 0;
    this.loadPlayers();
  }
}
