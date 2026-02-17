/**
 * MESSAGE MODEL - PremadeGG
 *
 * Mensajes individuales dentro de una conversación.
 * Incluye seguimiento de lectura por participante.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    /** Conversación a la que pertenece */
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },

    /** Usuario que envió el mensaje */
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /** Contenido del mensaje */
    content: {
      type: String,
      required: true,
      maxLength: 2000,
      trim: true,
    },

    /** Usuarios que han leído el mensaje */
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ── Índices ──────────────────────────────────────────
// Paginación de mensajes por conversación (más recientes primero)
messageSchema.index({ conversation: 1, createdAt: -1 });

// TTL: auto-borrar mensajes después de 90 días (opcional, ajustar según necesidad)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Message', messageSchema);
