/**
 * RIOT SERVICE - PremadeGG
 *
 * Servicio centralizado que actúa de proxy entre nuestro backend y las APIs externas:
 * - Riot Games API (account-v1): Validación de cuentas Riot.
 * - HenrikDev API (valorant/v3/mmr): Datos de rango/MMR de Valorant.
 *
 * El frontend NUNCA llama a estas APIs directamente.
 */

const axios = require('axios');

// ── Configuración de APIs ─────────────────────────────
const RIOT_BASE_URL = 'https://europe.api.riotgames.com';
const HENRIK_BASE_URL = 'https://api.henrikdev.xyz';

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

/**
 * Mapa para normalizar rangos de HenrikDev a nuestro enum de Valorant.
 * HenrikDev devuelve "Gold 1", "Platinum 3", etc. Nosotros solo guardamos el tier base.
 */
const RANK_NORMALIZE_MAP = {
  iron: 'Iron',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  ascendant: 'Ascendant',
  immortal: 'Immortal',
  radiant: 'Radiant',
};

/**
 * Normaliza un rango completo ("Gold 1") a nuestro enum ("Gold").
 * @param {string} fullRank - Ej: "Gold 1", "Immortal 3"
 * @returns {string} - Ej: "Gold", "Immortal"
 */
const normalizeRank = (fullRank) => {
  if (!fullRank) return null;
  const tierName = fullRank.split(' ')[0].toLowerCase();
  return RANK_NORMALIZE_MAP[tierName] || null;
};

// ── Riot Games API (account-v1) ───────────────────────

/**
 * Valida que una cuenta Riot existe usando account-v1.
 * @param {string} gameName - Nombre del jugador (ej: "Player")
 * @param {string} tagLine - Tag (ej: "EUW")
 * @returns {Promise<{puuid: string, gameName: string, tagLine: string}>}
 */
const validateAccount = async (gameName, tagLine) => {
  try {
    const response = await axios.get(
      `${RIOT_BASE_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      {
        headers: { 'X-Riot-Token': RIOT_API_KEY },
        timeout: 10000,
      },
    );

    return {
      puuid: response.data.puuid,
      gameName: response.data.gameName,
      tagLine: response.data.tagLine,
    };
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 404) {
        const error = new Error('Riot account not found');
        error.statusCode = 404;
        throw error;
      }
      if (status === 429) {
        const error = new Error('Riot API rate limit exceeded. Try again later.');
        error.statusCode = 429;
        throw error;
      }
      if (status === 403) {
        const error = new Error('Riot API key is invalid or expired');
        error.statusCode = 403;
        throw error;
      }
    }
    const error = new Error('Failed to validate Riot account');
    error.statusCode = 502;
    throw error;
  }
};

// ── HenrikDev API (MMR/Rank) ─────────────────────────

/**
 * Obtiene el rango competitivo real de un jugador via HenrikDev API.
 * @param {string} gameName - Nombre del jugador
 * @param {string} tagLine - Tag del jugador
 * @param {string} region - Región (eu, na, ap, kr)
 * @returns {Promise<{currentRank: string, normalizedRank: string, elo: number|null, images: object|null, accountLevel: number|null}>}
 */
const getPlayerRank = async (gameName, tagLine, region = 'eu') => {
  try {
    const headers = {};
    if (HENRIK_API_KEY) {
      headers.Authorization = HENRIK_API_KEY;
    }

    const response = await axios.get(
      `${HENRIK_BASE_URL}/valorant/v3/mmr/${region}/pc/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      {
        headers,
        timeout: 10000,
      },
    );

    const data = response.data?.data;

    // Extraer rango actual
    const currentTier = data?.current?.tier?.name || null;
    const normalizedRank = normalizeRank(currentTier);

    return {
      currentRank: currentTier,
      normalizedRank,
      elo: data?.current?.elo || null,
      images: data?.images || null,
      accountLevel: data?.account_level || null,
    };
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 404) {
        // Jugador no tiene datos de ranked / no encontrado en HenrikDev
        return {
          currentRank: null,
          normalizedRank: null,
          elo: null,
          images: null,
          accountLevel: null,
        };
      }
      if (status === 429) {
        const error = new Error('HenrikDev API rate limit exceeded. Try again later.');
        error.statusCode = 429;
        throw error;
      }
    }
    console.error('HenrikDev API error:', err.message);
    // No lanzamos error fatal; devolvemos null para que el flujo continúe
    return {
      currentRank: null,
      normalizedRank: null,
      elo: null,
      images: null,
      accountLevel: null,
    };
  }
};

module.exports = {
  validateAccount,
  getPlayerRank,
  normalizeRank,
};
