import { User } from './user.model';

export interface LfgMember {
  user: User;
  status: 'pending' | 'accepted';
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
  schedule: string;
  members: LfgMember[];
  status: 'open' | 'full' | 'closed';
  createdAt: string;
}

export type TeamSizeTab = 2 | 3 | 5;

export const TEAM_SIZE_LABELS: Record<TeamSizeTab, string> = {
  2: 'Duo',
  3: 'Trio',
  5: '5-Stack',
};
