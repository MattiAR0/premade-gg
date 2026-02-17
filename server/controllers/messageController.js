/**
 * MESSAGE CONTROLLER - PremadeGG
 *
 * Controlador de mensajería: conversaciones y mensajes.
 * Todas las operaciones requieren autenticación.
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const socketService = require('../services/socketService');

/** Campos a popular de User en conversaciones */
const USER_POPULATE_FIELDS = 'riotId rank profileImage profileImageType cardImage';

// ─────────────────────────────────────────────────────
// CONVERSACIONES
// ─────────────────────────────────────────────────────

/**
 * GET /api/messages/conversations
 * Lista las conversaciones del usuario autenticado.
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const cursor = req.query.cursor; // updatedAt ISO string

    const filter = { participants: userId };
    if (cursor) {
      filter.updatedAt = { $lt: new Date(cursor) };
    }

    const conversations = await Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit + 1)
      .populate('participants', USER_POPULATE_FIELDS)
      .populate('admin', 'riotId')
      .lean();

    const hasMore = conversations.length > limit;
    const data = hasMore ? conversations.slice(0, limit) : conversations;
    const nextCursor = hasMore ? data[data.length - 1].updatedAt.toISOString() : null;

    // Calcular unread count para cada conversación
    const conversationsWithUnread = await Promise.all(
      data.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          'readBy.user': { $ne: userId },
        });
        return { ...conv, unreadCount };
      }),
    );

    res.json({
      data: conversationsWithUnread,
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages/conversations/direct
 * Obtiene o crea una conversación directa con otro usuario.
 * Body: { targetUserId }
 */
const getOrCreateDirectConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId es obligatorio' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ message: 'No puedes crear una conversación contigo mismo' });
    }

    // Verificar que el usuario objetivo existe
    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Buscar conversación directa existente entre ambos usuarios
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [userId, targetUserId], $size: 2 },
    })
      .populate('participants', USER_POPULATE_FIELDS)
      .lean();

    if (conversation) {
      return res.json(conversation);
    }

    // Crear nueva conversación directa
    const newConversation = await Conversation.create({
      type: 'direct',
      participants: [userId, targetUserId],
    });

    conversation = await Conversation.findById(newConversation._id)
      .populate('participants', USER_POPULATE_FIELDS)
      .lean();

    // Unir a ambos usuarios al room de la conversación via socket
    socketService.joinUserToConversation(userId, newConversation._id.toString());
    socketService.joinUserToConversation(targetUserId, newConversation._id.toString());

    // Notificar al otro usuario que se creó una conversación
    socketService.emitToUser(targetUserId, 'conversation:new', conversation);

    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages/conversations/group
 * Crea una conversación grupal.
 * Body: { name, participantIds: string[] }
 */
const createGroupConversation = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, participantIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre del grupo es obligatorio' });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 1) {
      return res.status(400).json({ message: 'Debe incluir al menos 1 participante además de ti' });
    }

    // Incluir al creador si no está
    const allParticipants = [...new Set([userId, ...participantIds])];

    if (allParticipants.length < 2) {
      return res.status(400).json({ message: 'Un grupo necesita al menos 2 participantes' });
    }

    if (allParticipants.length > 20) {
      return res.status(400).json({ message: 'Máximo 20 participantes por grupo' });
    }

    // Verificar que todos los participantes existen
    const existingUsers = await User.find(
      { _id: { $in: allParticipants } },
      '_id',
    ).lean();

    if (existingUsers.length !== allParticipants.length) {
      return res.status(400).json({ message: 'Uno o más usuarios no existen' });
    }

    const newConversation = await Conversation.create({
      type: 'group',
      name: name.trim(),
      participants: allParticipants,
      admin: userId,
    });

    const conversation = await Conversation.findById(newConversation._id)
      .populate('participants', USER_POPULATE_FIELDS)
      .populate('admin', 'riotId')
      .lean();

    // Unir a todos los participantes al room
    for (const participantId of allParticipants) {
      socketService.joinUserToConversation(participantId, newConversation._id.toString());
    }

    // Notificar a todos los participantes (excepto al creador)
    for (const participantId of allParticipants) {
      if (participantId !== userId) {
        socketService.emitToUser(participantId, 'conversation:new', conversation);
      }
    }

    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────
// MENSAJES
// ─────────────────────────────────────────────────────

/**
 * GET /api/messages/conversations/:id/messages
 * Obtiene mensajes de una conversación con paginación cursor-based.
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const cursor = req.query.cursor; // createdAt ISO string

    // Verificar que el usuario es participante
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    const filter = { conversation: conversationId };
    if (cursor) {
      filter.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('sender', USER_POPULATE_FIELDS)
      .lean();

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null;

    res.json({
      data: data.reverse(), // Devolver en orden cronológico
      nextCursor,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages/conversations/:id/messages
 * Envía un mensaje a una conversación.
 * Body: { content }
 */
const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ message: 'El mensaje es demasiado largo (máx. 2000 caracteres)' });
    }

    // Verificar que el usuario es participante
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Crear el mensaje
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: content.trim(),
      readBy: [{ user: userId }], // El sender ya lo ha leído
    });

    // Actualizar lastMessage de la conversación
    conversation.lastMessage = {
      content: content.trim().substring(0, 100),
      sender: userId,
      createdAt: message.createdAt,
    };
    await conversation.save();

    // Popular sender para la respuesta y el broadcast
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', USER_POPULATE_FIELDS)
      .lean();

    // Emitir el mensaje a todos los participantes de la conversación
    socketService.emitToConversation(
      conversationId,
      'message:new',
      populatedMessage,
    );

    // Emitir actualización de conversación (para la lista de conversaciones)
    const updatedConversation = await Conversation.findById(conversationId)
      .populate('participants', USER_POPULATE_FIELDS)
      .lean();

    for (const participant of conversation.participants) {
      const pid = participant.toString();
      if (pid !== userId) {
        socketService.emitToUser(pid, 'conversation:updated', updatedConversation);
      }
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/messages/conversations/:id/read
 * Marca todos los mensajes de una conversación como leídos.
 */
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    // Verificar participación
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Marcar como leídos todos los mensajes no leídos por este usuario
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId },
      },
      {
        $push: { readBy: { user: userId, readAt: new Date() } },
      },
    );

    // Notificar a los demás que el usuario leyó los mensajes
    socketService.emitToConversation(conversationId, 'message:read', {
      conversationId,
      userId,
    });

    res.json({ message: 'Mensajes marcados como leídos' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/messages/unread-count
 * Devuelve el total de mensajes no leídos across all conversations.
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Obtener IDs de conversaciones del usuario
    const conversations = await Conversation.find(
      { participants: userId },
      '_id',
    ).lean();

    const conversationIds = conversations.map((c) => c._id);

    const count = await Message.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
    });

    res.json({ count });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getConversations,
  getOrCreateDirectConversation,
  createGroupConversation,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
};
