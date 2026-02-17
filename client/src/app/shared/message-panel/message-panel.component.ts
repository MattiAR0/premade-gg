import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MessageService } from '../../services/message.service';
import { AuthService } from '../../services/auth.service';
import { Conversation, ConversationParticipant } from '../../models/message.model';

@Component({
  selector: 'app-message-panel',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './message-panel.component.html',
  styleUrl: './message-panel.component.scss',
})
export class MessagePanelComponent {
  constructor(
    readonly messageService: MessageService,
    private readonly auth: AuthService,
  ) {}

  /** Abre el panel y carga conversaciones */
  toggle(): void {
    this.messageService.togglePanel();
  }

  /** Obtiene el nombre de una conversación */
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

  /** Obtiene la inicial */
  getConversationInitial(conversation: Conversation): string {
    const name = this.getConversationName(conversation);
    return name.charAt(0).toUpperCase();
  }

  /** Obtiene el otro participante en un chat directo */
  private getOtherParticipant(conversation: Conversation): ConversationParticipant | null {
    const myId = this.auth.currentUser()?._id;
    return conversation.participants.find((p) => p._id !== myId) || null;
  }
}
