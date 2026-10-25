import { Component, Input } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KarmaBadgeComponent } from '../karma-badge/karma-badge.component';
import { RankBadgeComponent } from '../rank-badge/rank-badge.component';
import { User, rolesOf } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { MessageService } from '../../services/message.service';
import { LabelPipe } from '../pipes/label.pipe';

@Component({
  selector: 'app-player-card',
  standalone: true,
  imports: [KarmaBadgeComponent, RankBadgeComponent, UpperCasePipe, RouterLink, LabelPipe],
  templateUrl: './player-card.component.html',
  styleUrl: './player-card.component.scss',
})
export class PlayerCardComponent {
  @Input({ required: true }) player!: User;

  /** Todos los roles que juega ("Controlador / Centinela") */
  get roles(): string[] {
    return rolesOf(this.player);
  }

  constructor(
    readonly auth: AuthService,
    private readonly messageService: MessageService,
  ) {}

  /** Obtiene la URL de la imagen de perfil según el tipo elegido */
  get avatarUrl(): string | null {
    if (this.player.profileImageType === 'riot_card' && this.player.cardImage) {
      return this.player.cardImage;
    }
    if (this.player.profileImage) {
      return this.player.profileImage;
    }
    return this.player.cardImage || null;
  }

  /** Abre un chat directo con este jugador */
  sendMessage(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.messageService.startDirectChat(this.player._id);
  }

  /** Mostrar botón solo si el usuario está autenticado y no es su propia tarjeta */
  get canMessage(): boolean {
    return this.auth.isAuthenticated() && this.auth.currentUser()?._id !== this.player._id;
  }
}
