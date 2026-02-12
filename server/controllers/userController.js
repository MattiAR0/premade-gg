const User = require('../models/User');
const Reputation = require('../models/Reputation');
const LFGPost = require('../models/LFGPost');
const { validateAccount, getPlayerRank } = require('../services/riotService');

/**
 * GET /api/users
 * Lista usuarios con paginación. Soporta filtros por query params.
 *
 * Query params:
 * - rank, role, minKarma: filtros
 * - page (default 1): número de página
 * - limit (default 12): resultados por página (max 100)
 *
 * Respuesta: { data: User[], total, page, limit, totalPages }
 */
const getUsers = async (req, res, next) => {
  try {
    const { rank, role, minKarma } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const filter = {};
    if (rank) filter.rank = rank;
    if (role) filter.role = role;
    if (minKarma) filter.karma = { $gte: Number(minKarma) };

    const [users, total] = await Promise.all([
      User.find(filter).sort({ karma: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Obtiene un usuario por su ID.
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users
 * Crea un nuevo usuario.
 * Valida el Riot ID contra la API de Riot y obtiene el rango real de HenrikDev.
 *
 * Body esperado: { riotId: "Player#TAG", role, schedule, region? }
 * - Si riotId contiene "#", se valida contra Riot API.
 * - El rank se obtiene automáticamente de HenrikDev (no se pasa en el body).
 */
const createUser = async (req, res, next) => {
  try {
    const { riotId, role, schedule, region = 'eu' } = req.body;

    if (!riotId || !riotId.includes('#')) {
      return res.status(400).json({ message: 'riotId must be in format "Name#Tag"' });
    }

    const [gameName, tagLine] = riotId.split('#');

    // 1. Validar cuenta en Riot API
    let riotAccount;
    try {
      riotAccount = await validateAccount(gameName, tagLine);
    } catch (err) {
      return res.status(err.statusCode || 502).json({ message: err.message });
    }

    // 2. Obtener rango real de HenrikDev
    const rankData = await getPlayerRank(gameName, tagLine, region);
    const rank = rankData.normalizedRank || 'Iron'; // Default a Iron si no tiene ranked

    // 3. Crear usuario con datos verificados
    const user = await User.create({
      riotId: `${riotAccount.gameName}#${riotAccount.tagLine}`,
      puuid: riotAccount.puuid,
      region,
      rank,
      role,
      schedule,
      accountLevel: rankData.accountLevel,
      cardImage: rankData.images?.large || null,
      lastRankUpdate: new Date(),
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'RiotID already exists' });
    }
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * Actualiza un usuario existente.
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Elimina un usuario y sus reviews asociadas.
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Limpiar reviews donde el usuario es author o target
    await Reputation.deleteMany({
      $or: [{ author: req.params.id }, { target: req.params.id }],
    });
    // Limpiar posts LFG creados por el usuario
    await LFGPost.deleteMany({ author: req.params.id });
    res.json({ message: 'User, related reviews and LFG posts deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/karma
 * Recalcula el karma de un usuario basándose en sus reviews recibidas.
 */
const recalculateKarma = async (req, res, next) => {
  try {
    const reviews = await Reputation.find({ target: req.params.id });
    if (reviews.length === 0) {
      return res.json({ karma: 5, reviewCount: 0, message: 'No reviews yet, default karma' });
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const karma = Math.round((totalRating / reviews.length) * 10) / 10;

    const user = await User.findByIdAndUpdate(req.params.id, { karma }, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ karma: user.karma, reviewCount: reviews.length });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  recalculateKarma,
};
