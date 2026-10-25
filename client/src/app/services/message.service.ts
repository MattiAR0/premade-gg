import { Injectable, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';
import { rpc } from './supabase.client';
import {
  Conversation,
  Message,
  ConversationsResponse,
  MessagesResponse,
} from '../models/message.model';

/**
 * Servicio de mensajería.
 * Gestiona conversaciones, mensajes, unread counts y eventos de Supabase Realtime.
 */
@Injectable({
  providedIn: 'root',
})
export class MessageService {
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
    private readonly auth: AuthService,
    private readonly socket: RealtimeService,
    private readonly router: Router,
  ) {
    // Suscribirse a eventos Realtime cuando se conecta
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

  // ── Realtime event listeners ───────────────────────

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
          if (idx === -1) {
            // Conversación aún no cargada en la lista: traerla completa
            this.fetchConversation(message.conversation);
            return convs;
          }

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
        this.conversations.update((convs) => [conv, ...convs.filter((c) => c._id !== conv._id)]);
      }),
    );

    // Expulsado de una conversación (p. ej. chat de un equipo que abandonas)
    this.socketSubs.push(
      this.socket.on<{ conversationId: string }>('conversation:removed').subscribe(({ conversationId }) => {
        this.conversations.update((convs) => convs.filter((c) => c._id !== conversationId));
        if (this.activeConversation()?._id === conversationId) {
          this.activeConversation.set(null);
          this.messages.set([]);
          this.socket.leaveTyping();
        }
        this.loadUnreadCount();
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

  // ── API methods (RPC) ──────────────────────────────

  /** Trae una conversación y la pone al principio de la lista */
  private fetchConversation(conversationId: string): void {
    rpc<Conversation | null>('get_conversation', { p_id: conversationId }).subscribe({
      next: (conv) => {
        if (!conv) return;
        this.conversations.update((convs) => [conv, ...convs.filter((c) => c._id !== conv._id)]);
      },
    });
  }

  /** Carga la lista de conversaciones */
  loadConversations(cursor?: string): void {
    this.loadingConversations.set(true);

    rpc<ConversationsResponse>('get_conversations', { p_cursor: cursor ?? null }).subscribe({
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

    rpc<MessagesResponse>('get_messages', { p_conversation_id: conversationId, p_cursor: cursor ?? null }).subscribe({
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
    rpc<Conversation>('get_or_create_direct_conversation', { p_target: targetUserId }).subscribe({
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
    rpc<Conversation>('create_group_conversation', { p_name: name, p_participant_ids: participantIds }).subscribe({
      next: (conversation) => {
        this.conversations.update((convs) => [conversation, ...convs]);
        this.router.navigate(['/messages', conversation._id]);
      },
    });
  }

  /** Envía un mensaje */
  sendMessage(conversationId: string, content: string): void {
    rpc<Message>('send_message', { p_conversation_id: conversationId, p_content: content }).subscribe();
    // La respuesta real llega via Realtime 'message:new'
  }

  /** Marca mensajes como leídos */
  markAsRead(conversationId: string): void {
    rpc('mark_conversation_read', { p_conversation_id: conversationId }).subscribe({
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
    rpc<number>('get_unread_message_count').subscribe({
      next: (count) => this.unreadCount.set(count),
    });
  }

  /** Selecciona una conversación y carga sus mensajes */
  selectConversation(conversation: Conversation): void {
    this.activeConversation.set(conversation);
    this.messages.set([]);
    this.messagesNextCursor.set(null);
    this.socket.joinTyping(conversation._id);
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
