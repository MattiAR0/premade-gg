const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    riotId: {
        type: String,
        required: true,
        unique: true
    },
    rank: {
        type: String,
        enum: ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'],
        required: true
    },
    role: {
        type: String,
        enum: ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'],
        required: true
    },
    schedule: {
        type: String, // e.g., "Afternoons", "Weekends"
        required: true
    },
    karma: {
        type: Number,
        default: 5,
        min: 0,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
