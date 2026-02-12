import { User } from './user.model';

export interface LfgPost {
  _id: string;
  author: User;
  title: string;
  description: string;
  requiredRoles: string[];
  minRank: string;
  minKarma: number;
  schedule: string;
  maxPlayers: number;
  status: string;
  createdAt: string;
}

export interface MatchmakingResult {
  postId: string;
  title: string;
  matchCount: number;
  players: User[];
}
