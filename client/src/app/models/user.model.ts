export interface User {
  _id: string;
  riotId: string;
  puuid: string | null;
  region: 'eu' | 'na' | 'ap' | 'kr';
  rank: string;
  role: string;
  schedule: string;
  karma: number;
  accountLevel: number | null;
  cardImage: string | null;
  lastRankUpdate: string | null;
  createdAt: string;
}
