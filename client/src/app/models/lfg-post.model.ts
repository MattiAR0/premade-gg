import { User } from './user.model';

export interface LfgMember {
  user: User;
  /** invited: lo añadió el creador y aún no ha aceptado (solo lo ven el creador y el invitado) */
  status: 'pending' | 'accepted' | 'invited';
  joinedAt: string;
}

export interface LfgPost {
  _id: string;
  author: User;
  title: string;
  description: string;
  teamSize: 2 | 3 | 5;
  minRank: string;
  minKarma: number;
  members: LfgMember[];
  status: 'open' | 'full' | 'closed';
  createdAt: string;
  expiresAt: string;
}

export type TeamSizeTab = 2 | 3 | 5;

export const TEAM_SIZE_LABELS: Record<TeamSizeTab, string> = {
  2: 'Dúo',
  3: 'Trío',
  5: '5-Stack',
};
