import { Injectable, signal, effect, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Servicio singleton de Socket.IO.
 * Se conecta automáticamente cuando el usuario está autenticado
 * y se desconecta al hacer logout.
 */
@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private readonly events$ = new Subject<{ event: string; data: unknown }>();

  /** Estado de la conexión */
  readonly connected = signal(false);

  constructor(
    private readonly auth: AuthService,
    private readonly zone: NgZone,
  ) {
    // Reaccionar a cambios de autenticación
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  /** Conecta al servidor Socket.IO */
  private connect(): void {
    if (this.socket?.connected) return;

    const token = this.auth.getToken();
    if (!token) return;

    const url = environment.socketUrl || window.location.origin;

    this.socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this.zone.run(() => this.connected.set(true));
      console.log('🔌 Socket.IO connected');
    });

    this.socket.on('disconnect', () => {
      this.zone.run(() => this.connected.set(false));
      console.log('🔌 Socket.IO disconnected');
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('Socket.IO connection error:', err.message);
    });

    // Proxy de todos los eventos al Subject
    this.socket.onAny((event: string, data: unknown) => {
      this.zone.run(() => {
        this.events$.next({ event, data });
      });
    });
  }

  /** Desconecta del servidor */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected.set(false);
    }
  }

  /**
   * Escucha un evento Socket.IO como Observable tipado.
   * @param eventName Nombre del evento
   * @returns Observable<T> con los datos del evento
   */
  on<T>(eventName: string): Observable<T> {
    return this.events$.pipe(
      filter((e) => e.event === eventName),
      map((e) => e.data as T),
    );
  }

  /**
   * Emite un evento al servidor Socket.IO.
   * @param event Nombre del evento
   * @param data Datos a enviar
   */
  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }
}
