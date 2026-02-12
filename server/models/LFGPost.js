const mongoose = require('mongoose');

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
  requiredRoles: [
    {
      type: String,
      enum: ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'],
    },
  ],
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
  maxPlayers: {
    type: Number,
    default: 5,
    min: 2,
    max: 5,
  },
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

module.exports = mongoose.model('LFGPost', lfgPostSchema);
