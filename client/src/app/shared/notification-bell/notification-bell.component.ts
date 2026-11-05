import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
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

  /** Invitación que se está respondiendo (desactiva sus botones) */
  respondingId: string | null = null;
  /** Error de respuesta por notificación */
  inviteErrors: Record<string, string> = {};

  constructor(
    readonly notificationService: NotificationService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  isInvite(notification: AppNotification): boolean {
    return notification.type === 'lfg_invite' || notification.type === 'team_invite';
  }

  respond(notification: AppNotification, accept: boolean): void {
    this.respondingId = notification._id;
    delete this.inviteErrors[notification._id];
    this.notificationService.respondToInvite(notification, accept).subscribe({
      next: () => {
        this.respondingId = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.respondingId = null;
        this.inviteErrors[notification._id] =
          err.error?.message || 'No se pudo responder a la invitación. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }

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
      case 'lfg_invite':
      case 'team_invite':
        return '✉️';
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
