const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
  rank: {
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
    required: true,
  },
  role: {
    type: String,
    enum: ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'],
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
