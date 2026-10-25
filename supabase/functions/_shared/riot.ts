// Port de server/services/riotService.js
// · Riot Games API (account-v1): validación de cuentas
// · HenrikDev API: rango (MMR), nivel y card de Valorant
import { HttpError } from './http.ts';

const RIOT_BASE_URL = 'https://europe.api.riotgames.com';
const HENRIK_BASE_URL = 'https://api.henrikdev.xyz';
const TIMEOUT_MS = 10_000;

export const REGIONS = ['eu', 'na', 'ap', 'kr'] as const;
export type Region = (typeof REGIONS)[number];

const RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];

/** "Gold 1" → "Gold" */
export const normalizeRank = (fullRank: string | null | undefined): string | null => {
  if (!fullRank) return null;
  const tier = fullRank.split(' ')[0].toLowerCase();
  return RANKS.find((r) => r.toLowerCase() === tier) ?? null;
};

/** "Name#Tag" → { gameName, tagLine } */
export const parseRiotId = (riotId: unknown) => {
  if (typeof riotId !== 'string' || !riotId.includes('#')) {
    throw new HttpError(400, 'El Riot ID debe tener el formato "Nombre#Tag"');
  }
  const idx = riotId.lastIndexOf('#');
  const gameName = riotId.slice(0, idx).trim();
  const tagLine = riotId.slice(idx + 1).trim();
  if (!gameName || !tagLine) throw new HttpError(400, 'El Riot ID debe tener el formato "Nombre#Tag"');
  return { gameName, tagLine };
};

const henrikHeaders = (): HeadersInit => {
  const key = Deno.env.get('HENRIK_API_KEY');
  return key ? { Authorization: key } : {};
};

const enc = encodeURIComponent;

/** Valida que la cuenta Riot existe. */
export const validateAccount = async (gameName: string, tagLine: string) => {
  let res: Response;
  try {
    res = await fetch(`${RIOT_BASE_URL}/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`, {
      headers: { 'X-Riot-Token': Deno.env.get('RIOT_API_KEY') ?? '' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'No se pudo validar la cuenta de Riot');
  }

  if (res.status === 404) throw new HttpError(404, 'Cuenta de Riot no encontrada');
  if (res.status === 429) throw new HttpError(429, 'Límite de la API de Riot alcanzado. Inténtalo más tarde.');
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'La API key de Riot es inválida o ha expirado');
  if (!res.ok) throw new HttpError(502, 'No se pudo validar la cuenta de Riot');

  const data = await res.json();
  return { puuid: data.puuid as string, gameName: data.gameName as string, tagLine: data.tagLine as string };
};

/** Nivel y card de la cuenta. Nunca lanza: si falla devuelve nulls. */
export const getPlayerAccount = async (gameName: string, tagLine: string) => {
  try {
    const res = await fetch(`${HENRIK_BASE_URL}/valorant/v1/account/${enc(gameName)}/${enc(tagLine)}`, {
      headers: henrikHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { accountLevel: null, card: null };
    const data = (await res.json())?.data;
    return {
      accountLevel: (data?.account_level as number) ?? null,
      card: (data?.card as { small: string; large: string; wide: string }) ?? null,
    };
  } catch (err) {
    console.error('HenrikDev Account API error:', err);
    return { accountLevel: null, card: null };
  }
};

/** Rango competitivo actual. Solo lanza en rate limit (429). */
export const getPlayerRank = async (gameName: string, tagLine: string, region: Region = 'eu') => {
  const empty = { currentRank: null, normalizedRank: null, elo: null };
  let res: Response;
  try {
    res = await fetch(`${HENRIK_BASE_URL}/valorant/v3/mmr/${region}/pc/${enc(gameName)}/${enc(tagLine)}`, {
      headers: henrikHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error('HenrikDev MMR API error:', err);
    return empty;
  }
  if (res.status === 429) throw new HttpError(429, 'Límite de la API de HenrikDev alcanzado. Inténtalo más tarde.');
  if (!res.ok) return empty;

  const data = (await res.json())?.data;
  const currentRank = (data?.current?.tier?.name as string) ?? null;
  return { currentRank, normalizedRank: normalizeRank(currentRank), elo: (data?.current?.elo as number) ?? null };
};

export const assertRegion = (region: unknown): Region => {
  const r = (region ?? 'eu') as Region;
  if (!REGIONS.includes(r)) throw new HttpError(400, `Región inválida. Debe ser una de: ${REGIONS.join(', ')}`);
  return r;
};
