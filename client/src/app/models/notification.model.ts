import { User } from './user.model';
import { LfgPost } from './lfg-post.model';

export type NotificationType =
  | 'join_request'
  | 'request_accepted'
  | 'request_rejected'
  | 'member_kicked'
  | 'lfg_invite'
  | 'team_invite'
  | 'report_update'
  | 'moderation_notice'
  | 'appeal_update';

export interface AppNotification {
  _id: string;
  recipient: string;
  /** null en los avisos de moderación (no se identifica al moderador) */
  sender: Pick<User, '_id' | 'riotId' | 'rank' | 'profileImage' | 'profileImageType'> | null;
  type: NotificationType;
  lfgPost: Pick<LfgPost, '_id' | 'title'> | null;
  /** Equipo de una invitación a equipo */
  team: { _id: string; name: string } | null;
  /** Denuncia a la que se refiere un aviso de moderación */
  reportId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}
