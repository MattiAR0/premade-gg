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
  errorMessage = '';

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    // Top 3 jugadores (ya vienen ordenados por karma desc desde el backend).
    // Una sola llamada: limit=3 trae solo 3 docs, y total nos da el conteo global.
    this.api.getUsers({ limit: 3, page: 1 }).subscribe({
      next: (res) => {
        this.topPlayers = res.data;
        this.totalPlayers = res.total;
      },
      error: (err) => {
        this.errorMessage = 'No se pudo conectar con el servidor.';
        console.error('Error loading top players:', err);
      },
    });
  }
}
