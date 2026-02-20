/**
 * CONVERSATION MODEL - PremadeGG
 *
 * Modelo para conversaciones (1-a-1 y grupales).
 * Almacena participantes, tipo, y referencia al último mensaje
 * para listados eficientes.
 */

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    /** Usuarios participantes (2 para direct, N para group) */
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],

    /** Tipo de conversación */
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },

    /** Nombre del grupo (solo para type: 'group') */
    name: {
      type: String,
      maxLength: 60,
      default: null,
    },

    /** Imagen del grupo (solo para type: 'group') */
    groupImage: {
      type: String,
      default: null,
    },

    /** Admin del grupo (quien lo creó, solo para type: 'group') */
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    /** Opcional: ID del equipo si es un chat de equipo */
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },

    /** Snapshot del último mensaje para listados */
    lastMessage: {
      content: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ── Índices ──────────────────────────────────────────
// Buscar conversaciones de un usuario, ordenadas por actualización
conversationSchema.index({ participants: 1, updatedAt: -1 });

// Buscar conversación directa existente entre dos usuarios
conversationSchema.index({ participants: 1, type: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
