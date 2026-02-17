import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import {
  Conversation,
  Message,
  ConversationsResponse,
  MessagesResponse,
} from '../models/message.model';

/**
 * Servicio de mensajería.
 * Gestiona conversaciones, mensajes, unread counts, y eventos de Socket.IO.
 */
@Injectable({
  providedIn: 'root',
})
export class MessageService {
  private readonly baseUrl = `${environment.apiUrl}/messages`;
  private socketSubs: Subscription[] = [];
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── State signals ──────────────────────────────────
  /** Lista de conversaciones */
  readonly conversations = signal<Conversation[]>([]);

  /** Conversación actualmente seleccionada */
  readonly activeConversation = signal<Conversation | null>(null);

  /** Mensajes de la conversación activa */
  readonly messages = signal<Message[]>([]);

  /** Total de mensajes no leídos */
  readonly unreadCount = signal(0);

  /** Mapa de conversationId → userId[] de usuarios escribiendo */
  readonly typingUsers = signal<Map<string, string[]>>(new Map());

  /** Cursor para paginación de mensajes */
  readonly messagesNextCursor = signal<string | null>(null);

  /** Si el panel mini-chat está abierto */
  readonly panelOpen = signal(false);

  /** Hay mensajes no leídos */
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  /** Loading states */
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly socket: SocketService,
    private readonly router: Router,
  ) {
    // Suscribirse a eventos Socket.IO cuando se conecta
    effect(() => {
      if (this.auth.isAuthenticated() && this.socket.connected()) {
        this.setupSocketListeners();
        this.loadUnreadCount();
      } else if (!this.auth.isAuthenticated()) {
        this.teardownSocketListeners();
        this.conversations.set([]);
        this.messages.set([]);
        this.activeConversation.set(null);
        this.unreadCount.set(0);
      }
    });
  }

  // ── Socket.IO event listeners ──────────────────────

  private setupSocketListeners(): void {
    this.teardownSocketListeners();

    // Nuevo mensaje
    this.socketSubs.push(
      this.socket.on<Message>('message:new').subscribe((message) => {
        const activeConv = this.activeConversation();

        // Si el mensaje es de la conversación activa, añadirlo
        if (activeConv && message.conversation === activeConv._id) {
          this.messages.update((msgs) => [...msgs, message]);

          // Auto-marcar como leído si no es mío
          if (message.sender._id !== this.auth.currentUser()?._id) {
            this.markAsRead(activeConv._id);
          }
        }

        // Actualizar lastMessage y mover la conversación al top
        this.conversations.update((convs) => {
          const idx = convs.findIndex((c) => c._id === message.conversation);
          if (idx === -1) return convs;

          const updated = { ...convs[idx] };
          updated.lastMessage = {
            content: message.content.substring(0, 100),
            sender: message.sender._id,
            createdAt: message.createdAt,
          };

          // Incrementar unread si no es la conversación activa o no soy yo
          if (
            message.sender._id !== this.auth.currentUser()?._id &&
            (!activeConv || activeConv._id !== message.conversation)
          ) {
            updated.unreadCount = (updated.unreadCount || 0) + 1;
          }

          const rest = convs.filter((c) => c._id !== message.conversation);
          return [updated, ...rest];
        });

        // Actualizar unread count global
        if (
          message.sender._id !== this.auth.currentUser()?._id &&
          (!activeConv || activeConv._id !== message.conversation)
        ) {
          this.unreadCount.update((c) => c + 1);
        }
      }),
    );

    // Nueva conversación
    this.socketSubs.push(
      this.socket.on<Conversation>('conversation:new').subscribe((conv) => {
        this.conversations.update((convs) => [conv, ...convs]);
        this.socket.emit('conversation:join', { conversationId: conv._id });
      }),
    );

    // Conversación actualizada (desde otro participante)
    this.socketSubs.push(
      this.socket.on<Conversation>('conversation:updated').subscribe((conv) => {
        this.conversations.update((convs) => {
          const rest = convs.filter((c) => c._id !== conv._id);
          return [conv, ...rest];
        });
      }),
    );

    // Indicador de typing
    this.socketSubs.push(
      this.socket.on<{ conversationId: string; userId: string }>('message:typing').subscribe(({ conversationId, userId }) => {
        if (userId === this.auth.currentUser()?._id) return;
        this.typingUsers.update((map) => {
          const newMap = new Map(map);
          const users = newMap.get(conversationId) || [];
          if (!users.includes(userId)) {
            newMap.set(conversationId, [...users, userId]);
          }
          return newMap;
        });
      }),
    );

    this.socketSubs.push(
      this.socket.on<{ conversationId: string; userId: string }>('message:stop-typing').subscribe(({ conversationId, userId }) => {
        this.typingUsers.update((map) => {
          const newMap = new Map(map);
          const users = newMap.get(conversationId) || [];
          newMap.set(conversationId, users.filter((u) => u !== userId));
          return newMap;
        });
      }),
    );

    // Lectura de mensajes
    this.socketSubs.push(
      this.socket.on<{ conversationId: string; userId: string }>('message:read').subscribe(({ conversationId, userId }) => {
        if (userId === this.auth.currentUser()?._id) return;
        this.messages.update((msgs) =>
          msgs.map((m) => {
            if (m.conversation === conversationId && !m.readBy.some((r) => r.user === userId)) {
              return { ...m, readBy: [...m.readBy, { user: userId, readAt: new Date().toISOString() }] };
            }
            return m;
          }),
        );
      }),
    );
  }

  private teardownSocketListeners(): void {
    this.socketSubs.forEach((s) => s.unsubscribe());
    this.socketSubs = [];
  }

  // ── REST API methods ───────────────────────────────

  /** Carga la lista de conversaciones */
  loadConversations(cursor?: string): void {
    this.loadingConversations.set(true);
    let params = new HttpParams();
    if (cursor) params = params.set('cursor', cursor);

    this.http.get<ConversationsResponse>(`${this.baseUrl}/conversations`, { params }).subscribe({
      next: (res) => {
        if (cursor) {
          this.conversations.update((convs) => [...convs, ...res.data]);
        } else {
          this.conversations.set(res.data);
        }
        this.loadingConversations.set(false);
      },
      error: () => this.loadingConversations.set(false),
    });
  }

  /** Carga mensajes de una conversación */
  loadMessages(conversationId: string, cursor?: string): void {
    this.loadingMessages.set(true);
    let params = new HttpParams();
    if (cursor) params = params.set('cursor', cursor);

    this.http.get<MessagesResponse>(`${this.baseUrl}/conversations/${conversationId}/messages`, { params }).subscribe({
      next: (res) => {
        if (cursor) {
          // Prepend al inicio (mensajes más antiguos arriba)
          this.messages.update((msgs) => [...res.data, ...msgs]);
        } else {
          this.messages.set(res.data);
        }
        this.messagesNextCursor.set(res.nextCursor);
        this.loadingMessages.set(false);
      },
      error: () => this.loadingMessages.set(false),
    });
  }

  /** Crea o abre un chat directo con un usuario */
  startDirectChat(targetUserId: string): void {
    this.http.post<Conversation>(`${this.baseUrl}/conversations/direct`, { targetUserId }).subscribe({
      next: (conversation) => {
        // Añadir a la lista si no existe
        this.conversations.update((convs) => {
          if (convs.some((c) => c._id === conversation._id)) return convs;
          return [conversation, ...convs];
        });
        // Navegar a la conversación
        this.router.navigate(['/messages', conversation._id]);
      },
    });
  }

  /** Crea una conversación grupal */
  createGroupConversation(name: string, participantIds: string[]): void {
    this.http.post<Conversation>(`${this.baseUrl}/conversations/group`, { name, participantIds }).subscribe({
      next: (conversation) => {
        this.conversations.update((convs) => [conversation, ...convs]);
        this.router.navigate(['/messages', conversation._id]);
      },
    });
  }

  /** Envía un mensaje */
  sendMessage(conversationId: string, content: string): void {
    this.http.post<Message>(`${this.baseUrl}/conversations/${conversationId}/messages`, { content }).subscribe();
    // La respuesta real llega via Socket.IO 'message:new'
  }

  /** Marca mensajes como leídos */
  markAsRead(conversationId: string): void {
    this.http.put(`${this.baseUrl}/conversations/${conversationId}/read`, {}).subscribe({
      next: () => {
        // Actualizar unread count de la conversación
        this.conversations.update((convs) =>
          convs.map((c) => {
            if (c._id === conversationId && c.unreadCount) {
              this.unreadCount.update((count) => Math.max(0, count - (c.unreadCount || 0)));
              return { ...c, unreadCount: 0 };
            }
            return c;
          }),
        );
      },
    });
  }

  /** Carga el total de mensajes no leídos */
  loadUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.baseUrl}/unread-count`).subscribe({
      next: (res) => this.unreadCount.set(res.count),
    });
  }

  /** Selecciona una conversación y carga sus mensajes */
  selectConversation(conversation: Conversation): void {
    this.activeConversation.set(conversation);
    this.messages.set([]);
    this.messagesNextCursor.set(null);
    this.loadMessages(conversation._id);
    this.markAsRead(conversation._id);
  }

  /** Emite indicador de typing con debounce */
  emitTyping(conversationId: string): void {
    this.socket.emit('message:typing', { conversationId });

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('message:stop-typing', { conversationId });
      this.typingTimeout = null;
    }, 2000);
  }

  /** Abre/cierra el panel flotante */
  togglePanel(): void {
    const isOpen = !this.panelOpen();
    this.panelOpen.set(isOpen);
    if (isOpen) {
      this.loadConversations();
    }
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }
}
