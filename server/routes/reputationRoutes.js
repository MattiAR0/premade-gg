const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReviewById,
  createReview,
  deleteReview,
} = require('../controllers/reputationController');
const { requireAuth } = require('../middlewares/auth');

// Públicos
router.get('/', getReviews);
router.get('/:id', getReviewById);

// Protegidos
router.post('/', requireAuth, createReview);
router.delete('/:id', requireAuth, deleteReview);

module.exports = router;
