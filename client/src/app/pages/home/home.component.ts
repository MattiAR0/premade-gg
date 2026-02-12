import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { PlayerCardComponent } from '../../shared/player-card/player-card.component';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, PlayerCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  topPlayers: User[] = [];
  totalPlayers = 0;

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.getUsers({ minKarma: 4 }).subscribe({
      next: (users) => {
        this.topPlayers = users.slice(0, 3);
      },
    });
    this.api.getUsers().subscribe({
      next: (users) => {
        this.totalPlayers = users.length;
      },
    });
  }
}
