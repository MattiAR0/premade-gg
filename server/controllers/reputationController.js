const Reputation = require('../models/Reputation');
const User = require('../models/User');

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
 */
const createReview = async (req, res, next) => {
  try {
    const { author, target, rating, comment } = req.body;

    // No puedes reviewearte a ti mismo
    if (author === target) {
      return res.status(400).json({ message: 'Cannot review yourself' });
    }

    // Verificar que ambos usuarios existen
    const [authorUser, targetUser] = await Promise.all([
      User.findById(author),
      User.findById(target),
    ]);

    if (!authorUser || !targetUser) {
      return res.status(404).json({ message: 'Author or target user not found' });
    }

    const review = await Reputation.create({ author, target, rating, comment });

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

module.exports = {
  getReviews,
  getReviewById,
  createReview,
  deleteReview,
};
