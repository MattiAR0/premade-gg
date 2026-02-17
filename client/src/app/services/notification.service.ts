import { Injectable, signal, computed, OnDestroy, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { AppNotification } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private socketSubs: Subscription[] = [];

  /** Todas las notificaciones cargadas */
  private readonly notificationsSignal = signal<AppNotification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();

  /** Contador de no leídas */
  private readonly unreadCountSignal = signal(0);
  readonly unreadCount = this.unreadCountSignal.asReadonly();

  /** Si el panel de notificaciones está abierto */
  private readonly panelOpenSignal = signal(false);
  readonly panelOpen = this.panelOpenSignal.asReadonly();

  /** Indica si hay notificaciones sin leer */
  readonly hasUnread = computed(() => this.unreadCountSignal() > 0);

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly socket: SocketService,
  ) {
    // Reacciona a cambios de autenticación y conexión de socket
    effect(() => {
      if (this.auth.isAuthenticated() && this.socket.connected()) {
        this.setupSocketListeners();
        this.refresh();
      } else if (!this.auth.isAuthenticated()) {
        this.teardownSocketListeners();
        this.notificationsSignal.set([]);
        this.unreadCountSignal.set(0);
      }
    });
  }

  ngOnDestroy(): void {
    this.teardownSocketListeners();
  }

  /** Configura listeners de Socket.IO para notificaciones en tiempo real */
  private setupSocketListeners(): void {
    this.teardownSocketListeners();

    this.socketSubs.push(
      this.socket.on<AppNotification>('notification:new').subscribe((notification) => {
        this.notificationsSignal.update((list) => [notification, ...list]);
        this.unreadCountSignal.update((c) => c + 1);
      }),
    );
  }

  private teardownSocketListeners(): void {
    this.socketSubs.forEach((s) => s.unsubscribe());
    this.socketSubs = [];
  }

  /** Carga las notificaciones y el contador */
  refresh(): void {
    if (!this.auth.isAuthenticated()) return;

    this.api.getUnreadNotificationCount().subscribe({
      next: (res) => this.unreadCountSignal.set(res.count),
    });

    this.api.getNotifications().subscribe({
      next: (notifications) => this.notificationsSignal.set(notifications),
    });
  }

  /** Abre/cierra el panel */
  togglePanel(): void {
    const isOpen = !this.panelOpenSignal();
    this.panelOpenSignal.set(isOpen);
    if (isOpen) {
      this.refresh();
    }
  }

  closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  /** Marca una notificación como leída */
  markAsRead(id: string): void {
    this.api.markNotificationAsRead(id).subscribe({
      next: () => {
        this.notificationsSignal.update((list) =>
          list.map((n) => (n._id === id ? { ...n, read: true } : n)),
        );
        this.unreadCountSignal.update((c) => Math.max(0, c - 1));
      },
    });
  }

  /** Marca todas como leídas */
  markAllAsRead(): void {
    this.api.markAllNotificationsAsRead().subscribe({
      next: () => {
        this.notificationsSignal.update((list) =>
          list.map((n) => ({ ...n, read: true })),
        );
        this.unreadCountSignal.set(0);
      },
    });
  }

  /** Elimina una notificación */
  delete(id: string): void {
    this.api.deleteNotification(id).subscribe({
      next: () => {
        const removed = this.notificationsSignal().find((n) => n._id === id);
        this.notificationsSignal.update((list) => list.filter((n) => n._id !== id));
        if (removed && !removed.read) {
          this.unreadCountSignal.update((c) => Math.max(0, c - 1));
        }
      },
    });
  }
}
