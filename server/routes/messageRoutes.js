/**
 * MESSAGE ROUTES - PremadeGG
 *
 * Rutas de mensajería: conversaciones y mensajes.
 * Todas protegidas con requireAuth.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const {
  getConversations,
  getOrCreateDirectConversation,
  createGroupConversation,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
} = require('../controllers/messageController');

// ── Conversaciones ────────────────────────────────────
router.get('/conversations', requireAuth, getConversations);
router.post('/conversations/direct', requireAuth, getOrCreateDirectConversation);
router.post('/conversations/group', requireAuth, createGroupConversation);

// ── Mensajes ──────────────────────────────────────────
router.get('/conversations/:id/messages', requireAuth, getMessages);
router.post('/conversations/:id/messages', requireAuth, sendMessage);
router.put('/conversations/:id/read', requireAuth, markAsRead);

// ── Contadores ────────────────────────────────────────
router.get('/unread-count', requireAuth, getUnreadCount);

module.exports = router;
