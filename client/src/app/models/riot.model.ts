export interface RiotAccountValidation {
  valid: boolean;
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface RiotRankData {
  currentRank: string | null;
  normalizedRank: string | null;
  elo: number | null;
  images: {
    large: string;
    small: string;
    triangle_down: string;
    triangle_up: string;
  } | null;
  accountLevel: number | null;
}
