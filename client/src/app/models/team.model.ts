import { User } from './user.model';

export interface TeamPlayer {
  user: User;
  role: 'Duelist' | 'Controller' | 'Initiator' | 'Sentinel' | 'Flex';
  joinedAt: string;
}

export interface TeamStaff {
  user: User;
  role: 'manager' | 'analyst' | 'content_creator' | 'streamer';
  joinedAt: string;
}

export interface TeamAchievement {
  title: string;
  date: string;
  description: string;
}

export interface Team {
  _id: string;
  name: string;
  tag: string;
  logo: string | null;
  description: string;
  owner: User;
  coach: User | null;
  staff: TeamStaff[];
  players: TeamPlayer[];
  region: 'eu' | 'na' | 'ap' | 'kr';
  targetRank: string;
  socialLinks: {
    discord: string;
    twitter: string;
    twitch: string;
    youtube: string;
  };
  achievements: TeamAchievement[];
  recruiting: boolean;
  recruitingRoles: string[];
  recruitingDetails: string;
  joinRequests?: {
    _id?: string;
    user: User;
    message: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
  }[];
  createdAt: string;
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  analyst: 'Analista',
  content_creator: 'Creador de Contenido',
  streamer: 'Streamer',
};

export const RECRUITING_ROLE_OPTIONS = [
  'Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex', 'Coach', 'Analyst',
] as const;
