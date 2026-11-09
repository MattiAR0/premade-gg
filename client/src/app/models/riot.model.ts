export interface RiotAccountValidation {
  valid: boolean;
  gameName: string;
  tagLine: string;
  /** Riot ID normalizado ("Nombre#Tag") */
  riotId?: string;
  /** Ya hay una cuenta de PremadeGG con este Riot ID */
  taken?: boolean;
}

export interface RiotRankData {
  currentRank: string | null;
  normalizedRank: string | null;
  elo: number | null;
  images?: {
    large: string;
    small: string;
    triangle_down: string;
    triangle_up: string;
  } | null;
  accountLevel?: number | null;
}

/** Reto de verificación del Riot ID con la tarjeta de jugador (Edge Function riot-verify) */
export interface RiotChallenge {
  riotId: string;
  region: string;
  /** equip: equipar `card` · change: equipar cualquier tarjeta que no sea `card` */
  mode: 'equip' | 'change';
  card: { id: string; name: string };
  createdAt: string;
  expiresAt: string;
  /** Primera partida hecha (con la otra tarjeta); falta volver a la de siempre y jugar otra */
  step1Done: boolean;
  verified: boolean;
}

export type RiotChallengeResult = 'verified' | 'step1_done' | 'no_match' | 'wrong_card';
