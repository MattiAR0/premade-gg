const Notification = require('../models/Notification');

/**
 * GET /api/notifications
 * Obtiene las notificaciones del usuario autenticado.
 * Query params: unreadOnly (boolean), limit (number)
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';

    const filter = { recipient: userId };
    if (unreadOnly) filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'riotId rank profileImage profileImageType')
      .populate('lfgPost', 'title')
      .lean();

    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 * Devuelve el número de notificaciones no leídas.
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/:id/read
 * Marca una notificación como leída.
 */
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permiso' });
    }

    notification.read = true;
    await notification.save();
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/read-all
 * Marca todas las notificaciones del usuario como leídas.
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true } },
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/:id
 * Elimina una notificación.
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permiso' });
    }

    await notification.deleteOne();
    res.json({ message: 'Notificación eliminada' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
