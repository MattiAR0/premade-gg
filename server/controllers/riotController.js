/**
 * RIOT CONTROLLER - PremadeGG
 *
 * Controlador proxy para las APIs de Riot Games y HenrikDev.
 * Expone endpoints para que el frontend valide cuentas y obtenga rangos
 * sin necesidad de exponer las API keys al cliente.
 */

const { validateAccount, getPlayerRank } = require('../services/riotService');

/**
 * GET /api/riot/validate/:gameName/:tagLine
 * Valida si un Riot ID existe usando la API oficial de Riot.
 */
const validateRiotId = async (req, res, next) => {
  try {
    const { gameName, tagLine } = req.params;

    if (!gameName || !tagLine) {
      return res.status(400).json({ message: 'gameName and tagLine are required' });
    }

    const account = await validateAccount(gameName, tagLine);
    res.json({
      valid: true,
      ...account,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/riot/rank/:region/:gameName/:tagLine
 * Obtiene el rango competitivo real de un jugador via HenrikDev API.
 */
const getRiotRank = async (req, res, next) => {
  try {
    const { region, gameName, tagLine } = req.params;
    const validRegions = ['eu', 'na', 'ap', 'kr'];

    if (!validRegions.includes(region)) {
      return res.status(400).json({
        message: `Invalid region. Must be one of: ${validRegions.join(', ')}`,
      });
    }

    if (!gameName || !tagLine) {
      return res.status(400).json({ message: 'gameName and tagLine are required' });
    }

    const rankData = await getPlayerRank(gameName, tagLine, region);
    res.json(rankData);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
};

module.exports = {
  validateRiotId,
  getRiotRank,
};
