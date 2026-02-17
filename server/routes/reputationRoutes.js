const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReviewById,
  createReview,
  deleteReview,
  checkEligibility,
} = require('../controllers/reputationController');
const { requireAuth } = require('../middlewares/auth');

// Públicos
router.get('/', getReviews);

// Protegidos (eligibility antes de :id para evitar conflicto de rutas)
router.get('/eligibility/:targetId', requireAuth, checkEligibility);
router.get('/:id', getReviewById);
router.post('/', requireAuth, createReview);
router.delete('/:id', requireAuth, deleteReview);

module.exports = router;
