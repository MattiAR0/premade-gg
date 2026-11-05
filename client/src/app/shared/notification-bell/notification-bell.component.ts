import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { AppNotification } from '../../models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  @ViewChild('bellButton') private bellButton?: ElementRef<HTMLButtonElement>;

  constructor(readonly notificationService: NotificationService) {}

  /** Esc cierra el panel y devuelve el foco a la campana */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.notificationService.panelOpen()) return;
    this.notificationService.closePanel();
    this.bellButton?.nativeElement.focus();
  }

  /** Icono según tipo de notificación */
  getIcon(type: AppNotification['type']): string {
    switch (type) {
      case 'join_request':
        return '📥';
      case 'request_accepted':
        return '✅';
      case 'request_rejected':
        return '❌';
      case 'member_kicked':
        return '🚫';
      default:
        return '🔔';
    }
  }

  onNotificationClick(notification: AppNotification): void {
    if (!notification.read) {
      this.notificationService.markAsRead(notification._id);
    }
  }
}
