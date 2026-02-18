const Reputation = require('../models/Reputation');
const User = require('../models/User');
const LFGPost = require('../models/LFGPost');
const Team = require('../models/Team');

/**
 * Comprueba si dos usuarios han jugado juntos:
 * - Co-miembros aceptados en un post LFG (incluyendo el author como miembro implícito)
 * - Compañeros en un equipo (players, coach, owner)
 */
const checkPlayedTogetherInternal = async (userA, userB) => {
  const [lfgMatch, teamMatch] = await Promise.all([
    // 1) Buscar post LFG donde ambos participaron como accepted o author
    LFGPost.findOne({
      $or: [
        // userA es author y userB es miembro aceptado
        { author: userA, 'members.user': userB, 'members.status': 'accepted' },
        // userB es author y userA es miembro aceptado
        { author: userB, 'members.user': userA, 'members.status': 'accepted' },
        // Ambos son miembros aceptados
        {
          members: {
            $all: [
              { $elemMatch: { user: userA, status: 'accepted' } },
              { $elemMatch: { user: userB, status: 'accepted' } },
            ],
          },
        },
      ],
    }).lean(),
    // 2) Buscar equipo donde ambos pertenecen (players, coach, owner)
    Team.findOne({
      $and: [
        {
          $or: [{ owner: userA }, { coach: userA }, { 'players.user': userA }],
        },
        {
          $or: [{ owner: userB }, { coach: userB }, { 'players.user': userB }],
        },
      ],
    }).lean(),
  ]);

  return !!(lfgMatch || teamMatch);
};

/**
 * GET /api/reviews
 * Lista todas las reviews. Soporta filtro por target (usuario evaluado).
 */
const getReviews = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.target) filter.target = req.query.target;
    if (req.query.author) filter.author = req.query.author;

    const reviews = await Reputation.find(filter)
      .populate('author', 'riotId rank role')
      .populate('target', 'riotId rank role')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/:id
 * Obtiene una review por su ID.
 */
const getReviewById = async (req, res, next) => {
  try {
    const review = await Reputation.findById(req.params.id)
      .populate('author', 'riotId rank role')
      .populate('target', 'riotId rank role');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json(review);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/reviews
 * Crea una review y recalcula el karma del target.
 * Detecta automáticamente si ambos jugadores han jugado juntos.
 */
const createReview = async (req, res, next) => {
  try {
    const { target, rating, comment } = req.body;
    const author = req.user.id; // Tomamos el author del token JWT

    // No puedes reviewearte a ti mismo
    if (author === target) {
      return res.status(400).json({ message: 'Cannot review yourself' });
    }

    // Verificar que el target existe
    const targetUser = await User.findById(target);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Detectar si han jugado juntos
    const playedTogether = await checkPlayedTogetherInternal(author, target);

    const review = await Reputation.create({ author, target, rating, comment, playedTogether });

    // Recalcular karma del target
    const reviews = await Reputation.find({ target });
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const karma = Math.round((totalRating / reviews.length) * 10) / 10;
    await User.findByIdAndUpdate(target, { karma });

    const populated = await review.populate([
      { path: 'author', select: 'riotId rank role' },
      { path: 'target', select: 'riotId rank role karma' },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You already reviewed this user' });
    }
    next(err);
  }
};

/**
 * DELETE /api/reviews/:id
 * Elimina una review y recalcula el karma del target.
 */
const deleteReview = async (req, res, next) => {
  try {
    const review = await Reputation.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Recalcular karma del target tras eliminar
    const reviews = await Reputation.find({ target: review.target });
    const karma =
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 5;
    await User.findByIdAndUpdate(review.target, { karma });

    res.json({ message: 'Review deleted, karma recalculated' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/eligibility/:targetId
 * Comprueba si el usuario logueado puede dejar una review al target
 * y si han jugado juntos.
 */
const checkEligibility = async (req, res, next) => {
  try {
    const authorId = req.user.id;
    const targetId = req.params.targetId;

    if (authorId === targetId) {
      return res.json({
        canReview: false,
        reason: 'self',
        playedTogether: false,
        existingReview: null,
      });
    }

    // ¿Ya existe una review?
    const existing = await Reputation.findOne({ author: authorId, target: targetId })
      .populate('author', 'riotId rank role')
      .populate('target', 'riotId rank role');

    // ¿Han jugado juntos?
    const playedTogether = await checkPlayedTogetherInternal(authorId, targetId);

    res.json({
      canReview: !existing,
      reason: existing ? 'already_reviewed' : null,
      playedTogether,
      existingReview: existing || null,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getReviews,
  getReviewById,
  createReview,
  deleteReview,
  checkEligibility,
};
