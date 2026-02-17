const mongoose = require('mongoose');

// ── Roles dentro del staff ─────────────────────────────
const STAFF_ROLES = ['manager', 'analyst', 'content_creator', 'streamer'];

const staffSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: STAFF_ROLES,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const playerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'],
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const teamSchema = new mongoose.Schema({
  // ── Identidad ──────────────────────────────────────
  name: {
    type: String,
    required: true,
    unique: true,
    maxLength: 40,
    trim: true,
  },
  tag: {
    type: String,
    required: true,
    maxLength: 6,
    uppercase: true,
    trim: true,
  },
  logo: {
    type: String,
    default: null,
  },

  // ── Historia y descripción ─────────────────────────
  description: {
    type: String,
    maxLength: 1500,
    default: '',
  },

  // ── Personas ───────────────────────────────────────
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  staff: [staffSchema],
  players: [playerSchema],

  // ── Configuración ──────────────────────────────────
  region: {
    type: String,
    enum: ['eu', 'na', 'ap', 'kr'],
    default: 'eu',
  },
  targetRank: {
    type: String,
    enum: [
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Ascendant',
      'Immortal',
      'Radiant',
    ],
    default: 'Gold',
  },
  socialLinks: {
    discord: { type: String, default: '' },
    twitter: { type: String, default: '' },
    twitch: { type: String, default: '' },
    youtube: { type: String, default: '' },
  },

  // ── Logros ─────────────────────────────────────────
  achievements: [
    {
      title: { type: String, maxLength: 100 },
      date: { type: Date },
      description: { type: String, maxLength: 200 },
    },
  ],

  // ── Reclutamiento ──────────────────────────────────
  recruiting: {
    type: Boolean,
    default: false,
  },
  recruitingRoles: {
    type: [
      {
        type: String,
        enum: ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex', 'Coach', 'Analyst'],
      },
    ],
    default: [],
  },
  recruitingDetails: {
    type: String,
    maxLength: 500,
    default: '',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Índices ────────────────────────────────────────────
teamSchema.index({ region: 1, targetRank: 1, createdAt: -1 });
teamSchema.index({ recruiting: 1, createdAt: -1 });
teamSchema.index({ owner: 1 });
teamSchema.index({ name: 'text', tag: 'text' });

module.exports = mongoose.model('Team', teamSchema);
module.exports.STAFF_ROLES = STAFF_ROLES;
