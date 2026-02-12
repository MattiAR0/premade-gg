const LFGPost = require('../models/LFGPost');
const User = require('../models/User');

/**
 * GET /api/lfg
 * Lista posts LFG con paginación. Soporta filtros por query params.
 *
 * Query params:
 * - role, minRank, status: filtros
 * - page (default 1): número de página
 * - limit (default 12): resultados por página (max 100)
 *
 * Respuesta: { data: LFGPost[], total, page, limit, totalPages }
 */
const getPosts = async (req, res, next) => {
  try {
    const { role, minRank, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) {
      filter.status = status;
    } else {
      filter.status = 'open';
    }
    if (role) filter.requiredRoles = role;
    if (minRank) filter.minRank = minRank;

    const [posts, total] = await Promise.all([
      LFGPost.find(filter)
        .populate('author', 'riotId rank role karma')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LFGPost.countDocuments(filter),
    ]);

    res.json({
      data: posts,
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
 * GET /api/lfg/:id
 * Obtiene un post LFG por su ID.
 */
const getPostById = async (req, res, next) => {
  try {
    const post = await LFGPost.findById(req.params.id)
      .populate('author', 'riotId rank role karma')
      .lean();

    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }
    res.json(post);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/lfg
 * Crea un nuevo post LFG.
 * Core: Filtra autores tóxicos (karma < 3).
 */
const createPost = async (req, res, next) => {
  try {
    const author = await User.findById(req.body.author);
    if (!author) {
      return res.status(404).json({ message: 'Author not found' });
    }

    // CORE: Filtro anti-toxicidad
    if (author.karma < 3) {
      return res.status(403).json({
        message: 'Your karma is too low to create LFG posts. Minimum: 3.0',
        currentKarma: author.karma,
      });
    }

    const post = await LFGPost.create(req.body);
    const populated = await post.populate('author', 'riotId rank role karma');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/lfg/:id
 * Actualiza un post LFG.
 */
const updatePost = async (req, res, next) => {
  try {
    const post = await LFGPost.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('author', 'riotId rank role karma');

    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }
    res.json(post);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/lfg/:id
 * Elimina un post LFG.
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await LFGPost.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }
    res.json({ message: 'LFG Post deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/lfg/:id/matchmaking
 * Core: Busca jugadores compatibles para un post LFG.
 * Filtra por: karma >= minKarma, rol compatible, rango mínimo.
 */
const findCompatiblePlayers = async (req, res, next) => {
  try {
    const post = await LFGPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }

    // Orden de rangos para filtrar por mínimo
    const RANK_ORDER = [
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Ascendant',
      'Immortal',
      'Radiant',
    ];

    const filter = {
      _id: { $ne: post.author }, // Excluir al autor
      karma: { $gte: post.minKarma },
    };

    // Filtro de roles requeridos
    if (post.requiredRoles && post.requiredRoles.length > 0) {
      filter.role = { $in: [...post.requiredRoles, 'Flex'] }; // Flex siempre compatible
    }

    // Filtro de rango mínimo
    if (post.minRank) {
      const minRankIndex = RANK_ORDER.indexOf(post.minRank);
      const validRanks = RANK_ORDER.slice(minRankIndex);
      filter.rank = { $in: validRanks };
    }

    const players = await User.find(filter).sort({ karma: -1 }).limit(50).lean();

    res.json({
      postId: post._id,
      title: post.title,
      matchCount: players.length,
      players,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  findCompatiblePlayers,
};
