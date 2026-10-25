export interface User {
  _id: string;

  // Identidad
  email?: string;
  riotId: string;
  puuid: string | null;
  region: 'eu' | 'na' | 'ap' | 'kr';

  // Datos de juego
  rank: string;
  /** Rol principal (= roles[0]); lo mantiene la base de datos */
  role: string;
  /** Todos los roles que juega, en orden Duelista, Controlador, Iniciador, Centinela, Flex */
  roles?: string[];
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
  /** Día → franjas en las que juega (día sin franjas = no disponible) */
  availability: Availability;

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

export const VALORANT_RANKS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum',
  'Diamond', 'Ascendant', 'Immortal', 'Radiant',
] as const;

/** Roles de un jugador; si el perfil aún no trae roles, el rol principal */
export function rolesOf(user: Pick<User, 'role' | 'roles'> | null | undefined): string[] {
  if (user?.roles?.length) return user.roles;
  return user?.role ? [user.role] : [];
}

export const VALORANT_ROLES = [
  'Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex',
] as const;

export const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

/** Franjas del día, sin horas exactas: night = madrugada (00–08) … evening = noche (20–24) */
export const DAY_SLOTS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type DaySlot = (typeof DAY_SLOTS)[number];

export const DAY_SLOT_LABELS: Record<DaySlot, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
  night: 'Madrugada',
};

export type Availability = Partial<Record<string, DaySlot[]>>;

/**
 * Deja la disponibilidad en el formato de franjas. Los perfiles se migraron en SQL
 * (20261025000004); si aún llegara el formato antiguo ({ from, to, available }),
 * ese día se ignora y la usuaria elige sus franjas al editar.
 */
export function normalizeAvailability(raw: unknown): Availability {
  const out: Availability = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const slots = DAY_SLOTS.filter((s) => value.includes(s));
      if (slots.length) out[day] = slots;
    }
  }
  return out;
}

export const DAYS_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};
