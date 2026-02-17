import { User } from './user.model';

/** Tipo de conversación */
export type ConversationType = 'direct' | 'group';

/** Participante resumido */
export type ConversationParticipant = Pick<
  User,
  '_id' | 'riotId' | 'rank' | 'profileImage' | 'profileImageType' | 'cardImage'
>;

/** Snapshot del último mensaje */
export interface LastMessage {
  content: string;
  sender: string;
  createdAt: string;
}

/** Conversación */
export interface Conversation {
  _id: string;
  participants: ConversationParticipant[];
  type: ConversationType;
  name: string | null;
  groupImage: string | null;
  admin: { _id: string; riotId: string } | null;
  lastMessage: LastMessage | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Lectura de un mensaje */
export interface MessageReadBy {
  user: string;
  readAt: string;
}

/** Mensaje individual */
export interface Message {
  _id: string;
  conversation: string;
  sender: ConversationParticipant;
  content: string;
  readBy: MessageReadBy[];
  createdAt: string;
  updatedAt: string;
}

/** Respuesta paginada de conversaciones */
export interface ConversationsResponse {
  data: Conversation[];
  nextCursor: string | null;
}

/** Respuesta paginada de mensajes */
export interface MessagesResponse {
  data: Message[];
  nextCursor: string | null;
}
