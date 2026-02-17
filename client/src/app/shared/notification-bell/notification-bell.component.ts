import { Component } from '@angular/core';
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
  constructor(readonly notificationService: NotificationService) {}

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
