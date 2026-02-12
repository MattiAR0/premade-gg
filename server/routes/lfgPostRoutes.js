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

router.get('/', getPosts);
router.get('/:id', getPostById);
router.post('/', createPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.get('/:id/matchmaking', findCompatiblePlayers);

module.exports = router;
