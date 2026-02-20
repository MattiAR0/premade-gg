import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { MessagePanelComponent } from '../message-panel/message-panel.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NotificationBellComponent, MessagePanelComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  menuOpen = false;
  userMenuOpen = false;

  constructor(readonly authService: AuthService) { }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    document.body.style.overflow = this.menuOpen ? 'hidden' : '';
  }

  closeMenu(): void {
    this.menuOpen = false;
    document.body.style.overflow = '';
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  logout(): void {
    this.closeMenu();
    this.closeUserMenu();
    this.authService.logout();
  }

  /** Obtiene la primera letra del Riot ID o email para el avatar placeholder */
  getInitial(): string {
    const user = this.authService.currentUser();
    if (!user) return '?';
    return user.riotId?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?';
  }

  /** Obtiene la URL de la imagen de perfil actual según el tipo elegido */
  get avatarUrl(): string | null {
    const user = this.authService.currentUser();
    if (!user) return null;
    if (user.profileImageType === 'riot_card' && user.cardImage) {
      return user.cardImage;
    }
    if (user.profileImage) {
      return user.profileImage;
    }
    return user.cardImage || null;
  }
}
