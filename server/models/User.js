const mongoose = require('mongoose');

// ── Valorant Agents ────────────────────────────────────────
const VALORANT_AGENTS = [
  'Brimstone', 'Phoenix', 'Sage', 'Sova', 'Viper',
  'Cypher', 'Reyna', 'Killjoy', 'Breach', 'Omen',
  'Jett', 'Raze', 'Skye', 'Yoru', 'Astra',
  'KAY/O', 'Chamber', 'Neon', 'Fade', 'Harbor',
  'Gekko', 'Deadlock', 'Iso', 'Clove', 'Vyse', 'Tejo', 'Waylay',
];

const VALORANT_ROLES = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

const userSchema = new mongoose.Schema({
  // ── Autenticación ──────────────────────────────────────
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Nunca se retorna por defecto
  },

  // ── Reset de contraseña ────────────────────────────────
  resetPasswordToken: {
    type: String,
    select: false,
  },
  resetPasswordExpires: {
    type: Date,
    select: false,
  },

  // ── Identidad Riot ─────────────────────────────────────
  riotId: {
    type: String,
    required: true,
    unique: true,
  },
  puuid: {
    type: String,
    unique: true,
    sparse: true,
  },
  region: {
    type: String,
    enum: ['eu', 'na', 'ap', 'kr'],
    default: 'eu',
  },

  // ── Datos de juego ─────────────────────────────────────
  rank: {
    type: String,
    enum: [
      'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum',
      'Diamond', 'Ascendant', 'Immortal', 'Radiant',
    ],
    required: true,
  },
  role: {
    type: String,
    enum: VALORANT_ROLES,
    required: true,
  },
  schedule: {
    type: String,
    required: true,
  },
  karma: {
    type: Number,
    default: 5,
    min: 0,
    max: 5,
  },
  accountLevel: {
    type: Number,
    default: null,
  },
  cardImage: {
    type: String,
    default: null,
  },
  lastRankUpdate: {
    type: Date,
    default: null,
  },

  // ── Perfil ─────────────────────────────────────────────
  bio: {
    type: String,
    maxLength: 500,
    default: '',
  },
  profileImage: {
    type: String,
    default: null,
  },
  profileImageType: {
    type: String,
    enum: ['upload', 'avatar', 'riot_card'],
    default: 'riot_card',
  },
  favoriteAgents: {
    type: [{ type: String, enum: VALORANT_AGENTS }],
    validate: {
      validator: (v) => v.length <= 3,
      message: 'Maximum 3 favorite agents allowed',
    },
    default: [],
  },
  favoriteRole: {
    type: String,
    enum: VALORANT_ROLES,
    default: null,
  },
  socialLinks: {
    discord: { type: String, default: '' },
    twitter: { type: String, default: '' },
    twitch: { type: String, default: '' },
  },
  availability: {
    type: Map,
    of: new mongoose.Schema(
      {
        from: { type: String, default: '' },
        to: { type: String, default: '' },
        available: { type: Boolean, default: false },
      },
      { _id: false },
    ),
    default: {},
  },

  // ── Looking For Team (LFT) ─────────────────────────────
  lookingForTeam: {
    type: Boolean,
    default: false,
  },
  lftDetails: {
    type: String,
    maxLength: 300,
    default: '',
  },

  // ── Coach ──────────────────────────────────────────────
  isCoach: {
    type: Boolean,
    default: false,
  },
  coachDetails: {
    type: String,
    maxLength: 500,
    default: '',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Índices para rendimiento de consultas ──────────────────
userSchema.index({ rank: 1, role: 1, karma: -1 });
userSchema.index({ karma: -1 });
userSchema.index({ lookingForTeam: 1, karma: -1 });
// email ya tiene unique: true en el schema, no necesita índice explícito

module.exports = mongoose.model('User', userSchema);
module.exports.VALORANT_AGENTS = VALORANT_AGENTS;
module.exports.VALORANT_ROLES = VALORANT_ROLES;
