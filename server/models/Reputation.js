const mongoose = require('mongoose');

const reputationSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    target: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: {
        type: String,
        maxLength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent duplicate reviews from same author to same target
reputationSchema.index({ author: 1, target: 1 }, { unique: true });

module.exports = mongoose.model('Reputation', reputationSchema);
