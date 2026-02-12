const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReviewById,
  createReview,
  deleteReview,
} = require('../controllers/reputationController');

router.get('/', getReviews);
router.get('/:id', getReviewById);
router.post('/', createReview);
router.delete('/:id', deleteReview);

module.exports = router;
