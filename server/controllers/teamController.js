const Team = require('../models/Team');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const socketService = require('../services/socketService');

const POPULATE_FIELDS =
  'riotId rank role karma region cardImage profileImage profileImageType isCoach';

/**
 * GET /api/teams
 * Lista equipos con paginación cursor-based.
 * Query: region, targetRank, recruiting, cursor, limit, search
 */
const getTeams = async (req, res, next) => {
  try {
    const { region, targetRank, recruiting, cursor, search } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));

    const filter = {};
    if (region) filter.region = region;
    if (targetRank) filter.targetRank = targetRank;
    if (recruiting === 'true') filter.recruiting = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } },
      ];
    }

    if (cursor) {
      const separatorIdx = cursor.indexOf('_');
      const cursorDate = new Date(cursor.substring(0, separatorIdx));
      const cursorId = cursor.substring(separatorIdx + 1);
      if (!isNaN(cursorDate.getTime()) && cursorId) {
        filter.$or = [
          ...(filter.$or || []),
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ];
        // Si ya hay $or por search, combinamos con $and
        if (search) {
          const searchFilter = {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { tag: { $regex: search, $options: 'i' } },
            ],
          };
          const cursorFilter = {
            $or: [
              { createdAt: { $lt: cursorDate } },
              { createdAt: cursorDate, _id: { $lt: cursorId } },
            ],
          };
          delete filter.$or;
          filter.$and = [searchFilter, cursorFilter];
        }
      }
    }

    const queries = [
      Team.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate('owner', POPULATE_FIELDS)
        .populate('coach', POPULATE_FIELDS)
        .populate('players.user', POPULATE_FIELDS)
        .populate('staff.user', POPULATE_FIELDS)
        .lean(),
    ];

    if (!cursor) {
      const countFilter = {};
      if (region) countFilter.region = region;
      if (targetRank) countFilter.targetRank = targetRank;
      if (recruiting === 'true') countFilter.recruiting = true;
      if (search) {
        countFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { tag: { $regex: search, $options: 'i' } },
        ];
      }
      queries.push(Team.countDocuments(countFilter));
    }

    const [teams, total] = await Promise.all(queries);

    const lastTeam = teams[teams.length - 1];
    const nextCursor =
      lastTeam && teams.length === limit
        ? `${lastTeam.createdAt.toISOString()}_${lastTeam._id}`
        : null;

    const resolvedTotal = !cursor && total !== undefined ? total : -1;

    res.json({
      data: teams,
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
 * GET /api/teams/:id
 */
const getTeamById = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', POPULATE_FIELDS)
      .populate('coach', POPULATE_FIELDS)
      .populate('players.user', POPULATE_FIELDS)
      .populate('staff.user', POPULATE_FIELDS)
      .populate('joinRequests.user', POPULATE_FIELDS)
      .lean();

    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    res.json(team);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/teams
 */
const createTeam = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      name,
      tag,
      description,
      region,
      targetRank,
      socialLinks,
      recruiting,
      recruitingRoles,
      recruitingDetails,
      initialPlayers, // New field for initial members
    } = req.body;

    // Validate initialPlayers if present
    let initialPlayersList = [];
    if (initialPlayers && Array.isArray(initialPlayers)) {
      initialPlayersList = [...new Set(initialPlayers)];
      if (initialPlayersList.length > 9) {
        return res.status(400).json({ message: 'Máximo 9 jugadores iniciales adicionales' });
      }
    }

    // Prepare initial team players (Owner + invited users)
    const teamPlayers = [{ user: userId, role: 'Flex', joinedAt: new Date() }];
    for (const pId of initialPlayersList) {
      if (pId !== userId) {
        teamPlayers.push({ user: pId, role: 'Flex', joinedAt: new Date() });
      }
    }

    const team = await Team.create({
      name,
      tag,
      description,
      owner: userId,
      region,
      targetRank,
      socialLinks,
      recruiting,
      recruitingRoles,
      recruitingDetails,
      players: teamPlayers,
    });

    // Create a group chat for the new team
    const teamConversation = await Conversation.create({
      type: 'group',
      name: `Team ${name}`,
      participants: [userId, ...initialPlayersList.filter((id) => id !== userId)],
      admin: userId,
      teamId: team._id,
    });

    // Join all participants to the chat and notify them
    for (const pId of teamConversation.participants) {
      const pIdStr = pId.toString();
      socketService.joinUserToConversation(pIdStr, teamConversation._id.toString());
      if (pIdStr === userId) {
        socketService.emitToUser(userId, 'conversation:new', teamConversation);
      } else {
        // We might need to populate this properly in real app, but for now we just emit
        socketService.emitToUser(pIdStr, 'conversation:new', teamConversation);
      }
    }

    const populated = await team.populate([
      { path: 'owner', select: POPULATE_FIELDS },
      { path: 'players.user', select: POPULATE_FIELDS },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un equipo con ese nombre' });
    }
    next(err);
  }
};

/**
 * PUT /api/teams/:id
 */
const updateTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede editar el equipo' });
    }

    const allowedFields = [
      'name',
      'tag',
      'logo',
      'description',
      'region',
      'targetRank',
      'socialLinks',
      'recruiting',
      'recruitingRoles',
      'recruitingDetails',
      'achievements',
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        team[field] = req.body[field];
      }
    }

    await team.save();
    await team.populate([
      { path: 'owner', select: POPULATE_FIELDS },
      { path: 'coach', select: POPULATE_FIELDS },
      { path: 'players.user', select: POPULATE_FIELDS },
      { path: 'staff.user', select: POPULATE_FIELDS },
    ]);

    res.json(team);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/teams/:id
 */
const deleteTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede eliminar el equipo' });
    }

    // Optional: Delete the team conversation
    await Conversation.deleteOne({ teamId: team._id });

    await team.deleteOne();
    res.json({ message: 'Equipo eliminado' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/teams/:id/coach
 * Asignar coach. Body: { userId }
 * Solo el owner puede asignar. El usuario debe tener isCoach = true.
 */
const setCoach = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede asignar coach' });
    }

    const { userId } = req.body;
    if (!userId) {
      // Quitar coach
      team.coach = null;
      await team.save();
      return res.json({ message: 'Coach removido' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (!user.isCoach) {
      return res.status(400).json({ message: 'Este usuario no está registrado como coach' });
    }

    team.coach = userId;
    await team.save();
    await team.populate('coach', POPULATE_FIELDS);

    res.json({ message: 'Coach asignado', team });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/teams/:id/players
 * Agregar jugador. Body: { userId, role }
 */
const addPlayer = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede agregar jugadores' });
    }

    const { userId, role } = req.body;
    const exists = team.players.find((p) => p.user.toString() === userId);
    if (exists) {
      return res.status(400).json({ message: 'El jugador ya está en el equipo' });
    }

    if (team.players.length >= 10) {
      return res.status(400).json({ message: 'El equipo tiene el máximo de jugadores (10)' });
    }

    team.players.push({ user: userId, role: role || 'Flex' });
    await team.save();

    // Add player to the team conversation
    const conversation = await Conversation.findOneAndUpdate(
      { teamId: team._id },
      { $addToSet: { participants: userId } },
      { new: true },
    );
    if (conversation) {
      socketService.joinUserToConversation(userId, conversation._id.toString());
      socketService.emitToUser(userId, 'conversation:new', conversation);
      socketService.emitToConversation(
        conversation._id.toString(),
        'conversation:updated',
        conversation,
      );
    }

    await team.populate('players.user', POPULATE_FIELDS);

    res.json({ message: 'Jugador agregado', team });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/teams/:id/players/:userId
 */
const removePlayer = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    const requesterId = req.user.id;
    const targetUserId = req.params.userId;
    const isOwner = team.owner.toString() === requesterId;
    const isSelf = targetUserId === requesterId;

    if (!isOwner && !isSelf) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción' });
    }
    if (targetUserId === team.owner.toString()) {
      return res
        .status(400)
        .json({ message: 'El dueño no puede ser removido. Transfiere la propiedad primero.' });
    }

    const idx = team.players.findIndex((p) => p.user.toString() === targetUserId);
    if (idx === -1) {
      return res.status(404).json({ message: 'Jugador no encontrado en el equipo' });
    }

    team.players.splice(idx, 1);
    await team.save();

    // Remove player from the team conversation
    const conversation = await Conversation.findOneAndUpdate(
      { teamId: team._id },
      { $pull: { participants: targetUserId } },
      { new: true },
    );
    if (conversation) {
      // It's harder to force a socket to leave a room from outside, but we can emit an update
      socketService.emitToConversation(
        conversation._id.toString(),
        'conversation:updated',
        conversation,
      );
      // Optional: Inform the removed user
      socketService.emitToUser(targetUserId, 'conversation:removed', {
        conversationId: conversation._id,
      });
    }

    res.json({ message: isSelf ? 'Has abandonado el equipo' : 'Jugador removido' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/teams/:id/staff
 * Agregar staff. Body: { userId, role }
 */
const addStaff = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede agregar staff' });
    }

    const { userId, role } = req.body;
    const exists = team.staff.find((s) => s.user.toString() === userId);
    if (exists) {
      return res.status(400).json({ message: 'Ya es parte del staff' });
    }

    team.staff.push({ user: userId, role });
    await team.save();

    // Add staff to the team conversation
    const conversation = await Conversation.findOneAndUpdate(
      { teamId: team._id },
      { $addToSet: { participants: userId } },
      { new: true },
    );
    if (conversation) {
      socketService.joinUserToConversation(userId, conversation._id.toString());
      socketService.emitToUser(userId, 'conversation:new', conversation);
      socketService.emitToConversation(
        conversation._id.toString(),
        'conversation:updated',
        conversation,
      );
    }

    await team.populate('staff.user', POPULATE_FIELDS);

    res.json({ message: 'Staff agregado', team });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/teams/:id/staff/:userId
 */
const removeStaff = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede remover staff' });
    }

    const idx = team.staff.findIndex((s) => s.user.toString() === req.params.userId);
    if (idx === -1) {
      return res.status(404).json({ message: 'Staff no encontrado' });
    }

    team.staff.splice(idx, 1);
    await team.save();

    // Remove staff from the team conversation
    const conversation = await Conversation.findOneAndUpdate(
      { teamId: team._id },
      { $pull: { participants: req.params.userId } },
      { new: true },
    );
    if (conversation) {
      socketService.emitToConversation(
        conversation._id.toString(),
        'conversation:updated',
        conversation,
      );
      socketService.emitToUser(req.params.userId, 'conversation:removed', {
        conversationId: conversation._id,
      });
    }

    res.json({ message: 'Staff removido' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/teams/:id/requests
 * Body: { message: string }
 */
const requestToJoin = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    // Check if user is already in team
    const isPlayer = team.players.some((p) => p.user.toString() === req.user.id);
    const isStaff = team.staff.some((s) => s.user.toString() === req.user.id);
    if (isPlayer || isStaff || team.owner.toString() === req.user.id) {
      return res.status(400).json({ message: 'Ya eres miembro de este equipo' });
    }

    // Check if there is already a pending request
    const existingReq = team.joinRequests.find(
      (r) => r.user.toString() === req.user.id && r.status === 'pending',
    );
    if (existingReq) {
      return res
        .status(400)
        .json({ message: 'Ya tienes una solicitud pendiente para este equipo' });
    }

    const { message } = req.body;
    team.joinRequests.push({ user: req.user.id, message: message || '' });
    await team.save();

    res.json({ message: 'Solicitud enviada correctamente' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/teams/:id/requests/:userId
 * Body: { status: 'accepted' | 'rejected' }
 */
const reviewJoinRequest = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Solo el dueño puede revisar solicitudes' });
    }

    const requestUser = req.params.userId;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Estado de solicitud inválido' });
    }

    const requestIndex = team.joinRequests.findIndex(
      (r) => r.user.toString() === requestUser && r.status === 'pending',
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
    }

    // Actualizamos el estado en memoria para el histórico o lo borramos.
    // Optaremos por borrarlo de la lista para no llenar la base de datos de "rejected" o "accepted" antiguos.
    team.joinRequests.splice(requestIndex, 1);

    if (status === 'accepted') {
      team.players.push({ user: requestUser, role: 'Flex', joinedAt: new Date() });

      const conversation = await Conversation.findOneAndUpdate(
        { teamId: team._id },
        { $addToSet: { participants: requestUser } },
        { new: true },
      );
      if (conversation) {
        socketService.joinUserToConversation(requestUser, conversation._id.toString());
        socketService.emitToUser(requestUser, 'conversation:new', conversation);
        socketService.emitToConversation(
          conversation._id.toString(),
          'conversation:updated',
          conversation,
        );
      }
    }

    // Asegurarse de que Mongoose se entere de los cambios a los arrays
    team.markModified('joinRequests');
    team.markModified('players');

    await team.save();
    res.json({ message: `Solicitud ${status === 'accepted' ? 'aceptada' : 'rechazada'}` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  setCoach,
  addPlayer,
  removePlayer,
  addStaff,
  removeStaff,
  requestToJoin,
  reviewJoinRequest,
};
