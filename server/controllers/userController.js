const User = require('../models/User');
const Reputation = require('../models/Reputation');

/**
 * GET /api/users
 * Lista todos los usuarios. Soporta filtros por query params.
 */
const getUsers = async (req, res, next) => {
  try {
    const { rank, role, minKarma } = req.query;
    const filter = {};

    if (rank) filter.rank = rank;
    if (role) filter.role = role;
    if (minKarma) filter.karma = { $gte: Number(minKarma) };

    const users = await User.find(filter).sort({ karma: -1 });
    res.json(users);
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
    const user = await User.findById(req.params.id);
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
 */
const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
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
    res.json({ message: 'User and related reviews deleted' });
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
