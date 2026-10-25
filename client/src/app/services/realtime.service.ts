import { Injectable, signal, effect, untracked } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { supabase } from './supabase.client';

/**
 * Tiempo real con Supabase Realtime (sustituye a Socket.IO).
 *
 * · Canal privado `user:<id>`: la base de datos emite aquí los mismos eventos que
 *   antes enviaba el servidor (message:new, conversation:new, notification:new…).
 * · Canal privado `typing:<conversationId>`: indicador "escribiendo…" entre participantes.
 *
 * El acceso a cada canal lo controlan políticas RLS sobre realtime.messages.
 */
@Injectable({
  providedIn: 'root',
})
export class RealtimeService {
  private userChannel: RealtimeChannel | null = null;
  private typingChannel: RealtimeChannel | null = null;
  private typingConversationId: string | null = null;
  private readonly events$ = new Subject<{ event: string; data: unknown }>();

  /** Estado de la conexión del canal personal */
  readonly connected = signal(false);

  constructor(private readonly auth: AuthService) {
    effect(() => {
      const userId = this.auth.currentUser()?._id;
      untracked(() => (userId ? void this.connect(userId) : this.disconnect()));
    });
  }

  private async connect(userId: string): Promise<void> {
    if (this.userChannel?.topic === `realtime:user:${userId}`) return;
    this.disconnect();

    // Los canales privados necesitan el JWT del usuario
    await supabase.realtime.setAuth();

    this.userChannel = supabase
      .channel(`user:${userId}`, { config: { private: true } })
      .on('broadcast', { event: '*' }, ({ event, payload }) => this.events$.next({ event, data: payload }))
      .subscribe((status) => this.connected.set(status === 'SUBSCRIBED'));
  }

  private disconnect(): void {
    this.leaveTyping();
    if (this.userChannel) {
      void supabase.removeChannel(this.userChannel);
      this.userChannel = null;
    }
    this.connected.set(false);
  }

  /** Escucha un evento (mismos nombres que con Socket.IO) */
  on<T>(eventName: string): Observable<T> {
    return this.events$.pipe(
      filter((e) => e.event === eventName),
      map((e) => e.data as T),
    );
  }

  /**
   * Emite un evento de cliente. Solo se usan los de typing:
   * `message:typing` / `message:stop-typing` con { conversationId }.
   */
  emit(event: string, data?: { conversationId?: string }): void {
    const conversationId = data?.conversationId;
    const userId = this.auth.currentUser()?._id;
    if (!conversationId || !userId) return;

    this.joinTyping(conversationId);
    void this.typingChannel?.send({ type: 'broadcast', event, payload: { conversationId, userId } });
  }

  /** Se une al canal de typing de la conversación abierta (y sale del anterior) */
  joinTyping(conversationId: string): void {
    if (this.typingConversationId === conversationId) return;
    this.leaveTyping();
    this.typingConversationId = conversationId;
    this.typingChannel = supabase
      .channel(`typing:${conversationId}`, { config: { private: true } })
      .on('broadcast', { event: '*' }, ({ event, payload }) => this.events$.next({ event, data: payload }))
      .subscribe();
  }

  leaveTyping(): void {
    if (this.typingChannel) {
      void supabase.removeChannel(this.typingChannel);
      this.typingChannel = null;
    }
    this.typingConversationId = null;
  }
}
