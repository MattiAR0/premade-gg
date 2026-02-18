const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  /** Usuario que recibe la notificación */
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  /** Usuario que origina la acción */
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  /** Tipo de notificación */
  type: {
    type: String,
    enum: ['join_request', 'request_accepted', 'request_rejected', 'member_kicked'],
    required: true,
  },
  /** Post LFG relacionado (opcional, por si se amplía a otros tipos) */
  lfgPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LFGPost',
  },
  /** Mensaje descriptivo de la notificación */
  message: {
    type: String,
    required: true,
    maxLength: 300,
  },
  /** Si el usuario ha leído la notificación */
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  /** TTL: las notificaciones se borran automáticamente después de 30 días */
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
});

// Índice compuesto para consultas eficientes de notificaciones no leídas
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
