const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.get('/', requireAuth, getNotifications);
router.get('/unread-count', requireAuth, getUnreadCount);
router.put('/read-all', requireAuth, markAllAsRead);
router.put('/:id/read', requireAuth, markAsRead);
router.delete('/:id', requireAuth, deleteNotification);

module.exports = router;
