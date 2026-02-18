const LFGPost = require('../models/LFGPost');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { resolveAuthors } = require('../services/authorCache');
const socketService = require('../services/socketService');

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

/**
 * GET /api/lfg
 * Lista posts LFG con paginación cursor-based.
 * Query params: teamSize, minRank, status, cursor, limit, author
 */
const getPosts = async (req, res, next) => {
  try {
    const { teamSize, minRank, status, cursor, author } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));

    const filter = {};
    if (author) {
      filter.author = author;
    } else if (status) {
      filter.status = status;
    } else {
      filter.status = 'open';
    }
    if (teamSize) filter.teamSize = parseInt(teamSize, 10);
    if (minRank) filter.minRank = minRank;

    // ── Cursor-based pagination ──────────────────────────────
    if (cursor) {
      const separatorIdx = cursor.indexOf('_');
      const cursorDate = new Date(cursor.substring(0, separatorIdx));
      const cursorId = cursor.substring(separatorIdx + 1);
      if (!isNaN(cursorDate.getTime()) && cursorId) {
        filter.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ];
      }
    }

    const queries = [
      LFGPost.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate('members.user', 'riotId rank region cardImage profileImage profileImageType')
        .lean(),
    ];
    if (!cursor) {
      const countFilter = {};
      if (author) {
        countFilter.author = author;
      } else if (status) {
        countFilter.status = status;
      } else {
        countFilter.status = 'open';
      }
      if (teamSize) countFilter.teamSize = parseInt(teamSize, 10);
      if (minRank) countFilter.minRank = minRank;
      queries.push(LFGPost.countDocuments(countFilter));
    }

    const [rawPosts, total] = await Promise.all(queries);

    // Resolver autores con cache
    const posts = await resolveAuthors(rawPosts);

    const lastPost = posts[posts.length - 1];
    const nextCursor =
      lastPost && posts.length === limit
        ? `${lastPost.createdAt.toISOString()}_${lastPost._id}`
        : null;

    const resolvedTotal = !cursor && total !== undefined ? total : -1;

    res.json({
      data: posts,
      total: resolvedTotal,
      nextCursor,
      limit,
      totalPages: resolvedTotal >= 0 ? Math.ceil(resolvedTotal / limit) : -1,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/lfg/:id
 * Obtiene un post LFG por su ID con autor y miembros populados.
 */
const getPostById = async (req, res, next) => {
  try {
    const post = await LFGPost.findById(req.params.id)
      .populate('author', 'riotId rank role karma region cardImage profileImage profileImageType')
      .populate(
        'members.user',
        'riotId rank role karma region cardImage profileImage profileImageType',
      )
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
 * El autor autenticado se añade automáticamente como miembro aceptado.
 */
const createPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const author = await User.findById(userId);
    if (!author) {
      return res.status(404).json({ message: 'Author not found' });
    }

    // Filtro anti-toxicidad
    if (author.karma < 3) {
      return res.status(403).json({
        message: 'Tu karma es demasiado bajo para crear posts LFG. Mínimo: 3.0',
        currentKarma: author.karma,
      });
    }

    const { title, description, teamSize, minRank, minKarma, initialMembers } = req.body;

    // Miembros iniciales: el autor + los que haya seleccionado
    const members = [{ user: userId, status: 'accepted', joinedAt: new Date() }];

    if (Array.isArray(initialMembers) && initialMembers.length > 0) {
      // Max teamSize - 1 miembros adicionales (el autor ya cuenta)
      const maxExtra = (teamSize || 2) - 1;
      const extras = initialMembers.slice(0, maxExtra);
      for (const memberId of extras) {
        if (memberId === userId) continue; // No duplicar al autor
        const memberUser = await User.findById(memberId);
        if (memberUser) {
          members.push({ user: memberId, status: 'accepted', joinedAt: new Date() });
        }
      }
    }

    const post = await LFGPost.create({
      author: userId,
      title,
      description,
      teamSize,
      minRank,
      minKarma,
      members,
    });

    const populated = await post.populate([
      {
        path: 'author',
        select: 'riotId rank role karma region cardImage profileImage profileImageType',
      },
      {
        path: 'members.user',
        select: 'riotId rank role karma region cardImage profileImage profileImageType',
      },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/lfg/:id
 * Actualiza un post LFG (solo el creador).
 */
const updatePost = async (req, res, next) => {
  try {
    const post = await LFGPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el creador puede editar este post' });
    }

    const { title, description, minRank, minKarma, status } = req.body;
    if (title !== undefined) post.title = title;
    if (description !== undefined) post.description = description;
    if (minRank !== undefined) post.minRank = minRank;
    if (minKarma !== undefined) post.minKarma = minKarma;
    if (status !== undefined) post.status = status;

    await post.save();
    await post.populate([
      { path: 'author', select: 'riotId rank role karma region' },
      {
        path: 'members.user',
        select: 'riotId rank region cardImage profileImage profileImageType',
      },
    ]);
    res.json(post);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/lfg/:id
 * Elimina un post LFG (solo el creador).
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await LFGPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el creador puede eliminar este post' });
    }
    await post.deleteOne();
    res.json({ message: 'LFG Post deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/lfg/:id/join
 * Solicitar unirse a un grupo LFG. Crea una solicitud pendiente.
 */
const joinPost = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const post = await LFGPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }

    if (post.status !== 'open') {
      return res.status(400).json({ message: 'Este grupo ya no acepta solicitudes' });
    }

    // No permitir que el autor se una a su propio post
    if (post.author.toString() === userId) {
      return res.status(400).json({ message: 'Ya eres el creador de este grupo' });
    }

    // Verificar si ya es miembro o tiene solicitud pendiente
    const existingMember = post.members.find((m) => m.user.toString() === userId);
    if (existingMember) {
      const msg =
        existingMember.status === 'accepted'
          ? 'Ya eres miembro de este grupo'
          : 'Ya tienes una solicitud pendiente';
      return res.status(400).json({ message: msg });
    }

    // Validar karma mínimo
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.karma < post.minKarma) {
      return res.status(403).json({
        message: `Tu karma (${user.karma}) es menor al mínimo requerido (${post.minKarma})`,
      });
    }

    // Validar rango mínimo
    if (post.minRank) {
      const userRankIdx = RANK_ORDER.indexOf(user.rank);
      const minRankIdx = RANK_ORDER.indexOf(post.minRank);
      if (userRankIdx < minRankIdx) {
        return res.status(403).json({
          message: `Tu rango (${user.rank}) es menor al mínimo requerido (${post.minRank})`,
        });
      }
    }

    post.members.push({ user: userId, status: 'pending' });
    await post.save();

    // Notificar al creador del grupo
    const joinNotif = await Notification.create({
      recipient: post.author,
      sender: userId,
      type: 'join_request',
      lfgPost: post._id,
      message: `${user.riotId} quiere unirse a tu grupo "${post.title}"`,
    });
    const populatedJoinNotif = await Notification.findById(joinNotif._id)
      .populate('sender', 'riotId rank profileImage profileImageType')
      .populate('lfgPost', 'title')
      .lean();
    socketService.emitToUser(post.author.toString(), 'notification:new', populatedJoinNotif);

    res.status(201).json({ message: 'Solicitud enviada correctamente' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/lfg/:id/members/:userId
 * Aceptar o rechazar un miembro. Solo el creador puede hacerlo.
 * Body: { action: 'accept' | 'reject' }
 */
const handleMemberRequest = async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Acción inválida. Usa "accept" o "reject"' });
    }

    const post = await LFGPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el creador puede gestionar solicitudes' });
    }

    const memberIdx = post.members.findIndex((m) => m.user.toString() === req.params.userId);
    if (memberIdx === -1) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    if (action === 'reject') {
      post.members.splice(memberIdx, 1);
      await post.save();

      // Notificar al usuario rechazado
      const rejectNotif = await Notification.create({
        recipient: req.params.userId,
        sender: req.user.id,
        type: 'request_rejected',
        lfgPost: post._id,
        message: `Tu solicitud para unirte a "${post.title}" fue rechazada`,
      });
      const populatedRejectNotif = await Notification.findById(rejectNotif._id)
        .populate('sender', 'riotId rank profileImage profileImageType')
        .populate('lfgPost', 'title')
        .lean();
      socketService.emitToUser(req.params.userId, 'notification:new', populatedRejectNotif);

      return res.json({ message: 'Solicitud rechazada' });
    }

    // Aceptar
    const acceptedCount = post.members.filter((m) => m.status === 'accepted').length;
    if (acceptedCount >= post.teamSize) {
      return res.status(400).json({ message: 'El grupo ya está lleno' });
    }

    post.members[memberIdx].status = 'accepted';

    // Si se llena el equipo, cambiar status a full
    const newAcceptedCount = post.members.filter((m) => m.status === 'accepted').length;
    if (newAcceptedCount >= post.teamSize) {
      post.status = 'full';
    }

    await post.save();
    await post.populate(
      'members.user',
      'riotId rank region cardImage profileImage profileImageType',
    );

    // Notificar al usuario aceptado
    const acceptNotif = await Notification.create({
      recipient: req.params.userId,
      sender: req.user.id,
      type: 'request_accepted',
      lfgPost: post._id,
      message: `¡Tu solicitud para unirte a "${post.title}" fue aceptada!`,
    });
    const populatedAcceptNotif = await Notification.findById(acceptNotif._id)
      .populate('sender', 'riotId rank profileImage profileImageType')
      .populate('lfgPost', 'title')
      .lean();
    socketService.emitToUser(req.params.userId, 'notification:new', populatedAcceptNotif);

    res.json({ message: 'Miembro aceptado', post });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/lfg/:id/members/:userId
 * Salir del grupo o expulsar a un miembro.
 * - El propio usuario puede salirse
 * - El creador puede expulsar a cualquier miembro
 */
const leavePost = async (req, res, next) => {
  try {
    const post = await LFGPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'LFG Post not found' });
    }

    const targetUserId = req.params.userId;
    const requesterId = req.user.id;
    const isCreator = post.author.toString() === requesterId;
    const isSelf = targetUserId === requesterId;

    if (!isCreator && !isSelf) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción' });
    }

    // No permitir que el creador se expulse a sí mismo
    if (targetUserId === post.author.toString()) {
      return res
        .status(400)
        .json({ message: 'El creador no puede abandonar su propio grupo. Ciérralo en su lugar.' });
    }

    const memberIdx = post.members.findIndex((m) => m.user.toString() === targetUserId);
    if (memberIdx === -1) {
      return res.status(404).json({ message: 'Miembro no encontrado' });
    }

    const wasFull = post.status === 'full';
    post.members.splice(memberIdx, 1);

    // Si estaba lleno y ahora hay hueco, reabrir
    if (wasFull) {
      post.status = 'open';
    }

    await post.save();

    // Notificar al miembro expulsado (solo si es el creador quien expulsa)
    if (!isSelf && isCreator) {
      const kickNotif = await Notification.create({
        recipient: targetUserId,
        sender: requesterId,
        type: 'member_kicked',
        lfgPost: post._id,
        message: `Has sido expulsado del grupo "${post.title}"`,
      });
      const populatedKickNotif = await Notification.findById(kickNotif._id)
        .populate('sender', 'riotId rank profileImage profileImageType')
        .populate('lfgPost', 'title')
        .lean();
      socketService.emitToUser(targetUserId, 'notification:new', populatedKickNotif);
    }

    res.json({ message: isSelf ? 'Has abandonado el grupo' : 'Miembro expulsado' });
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
  joinPost,
  handleMemberRequest,
  leavePost,
};
