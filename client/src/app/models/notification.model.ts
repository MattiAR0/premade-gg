import { User } from './user.model';
import { LfgPost } from './lfg-post.model';

export type NotificationType =
  | 'join_request'
  | 'request_accepted'
  | 'request_rejected'
  | 'member_kicked'
  | 'lfg_invite'
  | 'team_invite';

export interface AppNotification {
  _id: string;
  recipient: string;
  sender: Pick<User, '_id' | 'riotId' | 'rank' | 'profileImage' | 'profileImageType'>;
  type: NotificationType;
  lfgPost: Pick<LfgPost, '_id' | 'title'> | null;
  /** Equipo de una invitación a equipo */
  team: { _id: string; name: string } | null;
  message: string;
  read: boolean;
  createdAt: string;
}
