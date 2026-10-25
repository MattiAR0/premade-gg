export interface RiotAccountValidation {
  valid: boolean;
  puuid: string;
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
