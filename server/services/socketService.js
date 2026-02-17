/**
 * SOCKET SERVICE - PremadeGG
 *
 * Módulo singleton que gestiona Socket.IO:
 * - Autenticación via JWT en el handshake
 * - Mapa de usuarios online (userId → Set<socketId>)
 * - Helpers para emitir a usuarios y rooms
 * - Eventos de conexión/desconexión
 */

const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');

const JWT_SECRET = process.env.JWT_SECRET || 'premadegg-dev-secret-change-in-prod';

/** @type {import('socket.io').Server | null} */
let io = null;

/** Mapa userId → Set<socketId> */
const onlineUsers = new Map();

/**
 * Inicializa Socket.IO con la instancia del servidor.
 * @param {import('socket.io').Server} socketIo
 */
const init = (socketIo) => {
  io = socketIo;

  // ── Middleware de autenticación ───────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Evento de conexión ───────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: ${userId} (${socket.id})`);

    // Registrar usuario online
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Unir al usuario a rooms de sus conversaciones
    try {
      const conversations = await Conversation.find({ participants: userId }, '_id').lean();

      for (const conv of conversations) {
        socket.join(`conversation:${conv._id}`);
      }
    } catch (err) {
      console.error('Error joining conversation rooms:', err.message);
    }

    // ── Evento: usuario escribiendo ────────────────
    socket.on('message:typing', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('message:typing', {
        conversationId,
        userId,
      });
    });

    socket.on('message:stop-typing', (data) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('message:stop-typing', {
        conversationId,
        userId,
      });
    });

    // ── Evento: unirse a una conversación nueva ────
    socket.on('conversation:join', (data) => {
      const { conversationId } = data;
      socket.join(`conversation:${conversationId}`);
    });

    // ── Desconexión ────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${userId} (${socket.id})`);
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });
};

/**
 * Emite un evento a un usuario específico (a todos sus sockets).
 * @param {string} userId
 * @param {string} event
 * @param {*} data
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
};

/**
 * Emite un evento a todos los participantes de una conversación.
 * @param {string} conversationId
 * @param {string} event
 * @param {*} data
 */
const emitToConversation = (conversationId, event, data) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
};

/**
 * Hace que un usuario específico se una al room de una conversación.
 * Útil cuando se crea una nueva conversación.
 * @param {string} userId
 * @param {string} conversationId
 */
const joinUserToConversation = (userId, conversationId) => {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`conversation:${conversationId}`);
      }
    }
  }
};

/**
 * Devuelve la lista de IDs de usuarios online.
 * @returns {string[]}
 */
const getOnlineUserIds = () => {
  return Array.from(onlineUsers.keys());
};

/**
 * Comprueba si un usuario está online.
 * @param {string} userId
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
};

/**
 * Devuelve la instancia de io (para uso externo si es necesario).
 * @returns {import('socket.io').Server | null}
 */
const getIo = () => io;

module.exports = {
  init,
  emitToUser,
  emitToConversation,
  joinUserToConversation,
  getOnlineUserIds,
  isUserOnline,
  getIo,
};
