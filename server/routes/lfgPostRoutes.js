const express = require('express');
const router = express.Router();
const {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  findCompatiblePlayers,
} = require('../controllers/lfgPostController');
const { requireAuth } = require('../middlewares/auth');

// Públicos
router.get('/', getPosts);
router.get('/:id', getPostById);
router.get('/:id/matchmaking', findCompatiblePlayers);

// Protegidos
router.post('/', requireAuth, createPost);
router.put('/:id', requireAuth, updatePost);
router.delete('/:id', requireAuth, deletePost);

module.exports = router;
