import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from '../../services/message.service';
import { AuthService } from '../../services/auth.service';
import { Conversation, ConversationParticipant } from '../../models/message.model';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLInputElement>;

  newMessage = '';
  mobileView: 'list' | 'chat' = 'list';

  // Group creation
  showGroupForm = false;
  groupName = '';

  constructor(
    readonly messageService: MessageService,
    readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.messageService.loadConversations();

    // Si se navega a /messages/:id, abrir esa conversación
    this.route.params.subscribe((params) => {
      if (params['id']) {
        this.openConversationById(params['id']);
      }
    });
  }

  ngOnDestroy(): void {
    this.messageService.activeConversation.set(null);
  }

  /** Abre una conversación por ID (desde la URL) */
  private openConversationById(id: string): void {
    // Intentar encontrarla en la lista cargada
    const existing = this.messageService.conversations().find((c) => c._id === id);
    if (existing) {
      this.selectConversation(existing);
    } else {
      // Esperar a que se carguen
      const interval = setInterval(() => {
        const conv = this.messageService.conversations().find((c) => c._id === id);
        if (conv) {
          clearInterval(interval);
          this.selectConversation(conv);
        }
      }, 200);
      // Timeout de 5s
      setTimeout(() => clearInterval(interval), 5000);
    }
  }

  /** Selecciona una conversación */
  selectConversation(conversation: Conversation): void {
    this.messageService.selectConversation(conversation);
    this.mobileView = 'chat';
    this.newMessage = '';
    this.cdr.markForCheck();
    // Auto-scroll al final después de que se carguen los mensajes
    setTimeout(() => this.scrollToBottom(), 300);
  }

  /** Volver a la lista en móvil */
  backToList(): void {
    this.mobileView = 'list';
    this.messageService.activeConversation.set(null);
  }

  /** Envía un mensaje */
  send(): void {
    const content = this.newMessage.trim();
    const conversationId = this.messageService.activeConversation()?._id;
    if (!content || !conversationId) return;

    this.messageService.sendMessage(conversationId, content);
    this.newMessage = '';
    setTimeout(() => this.scrollToBottom(), 100);
  }

  /** Maneja tecla Enter en el input */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  /** Notifica que el usuario está escribiendo */
  onTyping(): void {
    const conversationId = this.messageService.activeConversation()?._id;
    if (conversationId) {
      this.messageService.emitTyping(conversationId);
    }
  }

  /** Carga mensajes más antiguos al hacer scroll arriba */
  onScroll(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    if (container.scrollTop === 0 && this.messageService.messagesNextCursor()) {
      const conversationId = this.messageService.activeConversation()?._id;
      const cursor = this.messageService.messagesNextCursor();
      if (conversationId && cursor) {
        const previousHeight = container.scrollHeight;
        this.messageService.loadMessages(conversationId, cursor);
        // Preservar posición del scroll
        setTimeout(() => {
          container.scrollTop = container.scrollHeight - previousHeight;
        }, 100);
      }
    }
  }

  /** Obtiene el nombre a mostrar de una conversación */
  getConversationName(conversation: Conversation): string {
    if (conversation.type === 'group') {
      return conversation.name || 'Grupo';
    }
    const other = this.getOtherParticipant(conversation);
    return other?.riotId || 'Chat';
  }

  /** Obtiene la imagen de una conversación */
  getConversationImage(conversation: Conversation): string | null {
    if (conversation.type === 'group') {
      return conversation.groupImage;
    }
    const other = this.getOtherParticipant(conversation);
    if (!other) return null;
    return other.cardImage || other.profileImage;
  }

  /** Obtiene la inicial de una conversación */
  getConversationInitial(conversation: Conversation): string {
    const name = this.getConversationName(conversation);
    return name.charAt(0).toUpperCase();
  }

  /** Obtiene el otro participante en una conversación directa */
  getOtherParticipant(conversation: Conversation): ConversationParticipant | null {
    const myId = this.auth.currentUser()?._id;
    return conversation.participants.find((p) => p._id !== myId) || null;
  }

  /** Verifica si un mensaje es mío */
  isOwnMessage(senderId: string): boolean {
    return this.auth.currentUser()?._id === senderId;
  }

  /** Obtiene los usuarios escribiendo en la conversación activa */
  getActiveTypingUsers(): string[] {
    const activeConv = this.messageService.activeConversation();
    if (!activeConv) return [];
    return this.messageService.typingUsers().get(activeConv._id) || [];
  }

  /** Obtiene el nombre de un participante por su ID */
  getParticipantName(userId: string): string {
    const activeConv = this.messageService.activeConversation();
    if (!activeConv) return '';
    const participant = activeConv.participants.find((p) => p._id === userId);
    return participant?.riotId || '';
  }

  /** Formatea la fecha de un mensaje */
  isNewDay(index: number): boolean {
    const messages = this.messageService.messages();
    if (index === 0) return true;
    const current = new Date(messages[index].createdAt).toDateString();
    const previous = new Date(messages[index - 1].createdAt).toDateString();
    return current !== previous;
  }

  /** Scroll al final de los mensajes */
  private scrollToBottom(): void {
    const container = this.messagesContainer?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /** Toggle del formulario de grupo */
  toggleGroupForm(): void {
    this.showGroupForm = !this.showGroupForm;
    this.groupName = '';
  }
}
