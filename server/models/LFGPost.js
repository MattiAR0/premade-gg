const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const lfgPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxLength: 120,
  },
  description: {
    type: String,
    maxLength: 500,
  },
  teamSize: {
    type: Number,
    enum: [2, 3, 5],
    required: true,
  },
  minRank: {
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
  },
  minKarma: {
    type: Number,
    default: 3,
    min: 0,
    max: 5,
  },
  schedule: {
    type: String,
  },
  members: [memberSchema],
  status: {
    type: String,
    enum: ['open', 'full', 'closed'],
    default: 'open',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Índices para rendimiento de consultas ──────────────────
lfgPostSchema.index({ teamSize: 1, status: 1, createdAt: -1 });
lfgPostSchema.index({ author: 1 });

module.exports = mongoose.model('LFGPost', lfgPostSchema);
