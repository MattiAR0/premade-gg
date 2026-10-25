export interface User {
  _id: string;

  // Identidad
  email?: string;
  riotId: string;
  puuid: string | null;
  region: 'eu' | 'na' | 'ap' | 'kr';

  // Datos de juego
  rank: string;
  role: string;
  schedule: string;
  karma: number;
  /** Nº de valoraciones recibidas (base del karma). Opcional por compatibilidad. */
  reviewCount?: number;
  /** Karma ajustado (media bayesiana): decide orden, filtros y requisitos. Una cuenta nueva vale 3,5. */
  trustKarma?: number;
  accountLevel: number | null;
  cardImage: string | null;
  lastRankUpdate: string | null;

  // Perfil
  bio: string;
  profileImage: string | null;
  profileImageType: 'upload' | 'avatar' | 'riot_card';
  favoriteAgents: string[];
  favoriteRole: string | null;
  socialLinks: {
    discord: string;
    twitter: string;
    twitch: string;
  };
  availability: Record<string, { from: string; to: string; available: boolean }>;

  // Looking For Team
  lookingForTeam: boolean;
  lftDetails: string;

  // Coach
  isCoach: boolean;
  coachDetails: string;

  /** false hasta que el usuario vincula su Riot ID (p. ej. tras entrar con Google/Discord) */
  onboarded?: boolean;

  createdAt: string;
}

export const VALORANT_AGENTS = [
  'Brimstone', 'Phoenix', 'Sage', 'Sova', 'Viper',
  'Cypher', 'Reyna', 'Killjoy', 'Breach', 'Omen',
  'Jett', 'Raze', 'Skye', 'Yoru', 'Astra',
  'KAY/O', 'Chamber', 'Neon', 'Fade', 'Harbor',
  'Gekko', 'Deadlock', 'Iso', 'Clove', 'Vyse', 'Tejo', 'Waylay', 'Veto',
] as const;

export const VALORANT_RANKS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum',
  'Diamond', 'Ascendant', 'Immortal', 'Radiant',
] as const;

export const VALORANT_ROLES = [
  'Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex',
] as const;

export const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

export const DAYS_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};
