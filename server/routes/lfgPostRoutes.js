const express = require('express');
const router = express.Router();
const {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  joinPost,
  handleMemberRequest,
  leavePost,
} = require('../controllers/lfgPostController');
const { requireAuth } = require('../middlewares/auth');

// Públicos
router.get('/', getPosts);
router.get('/:id', getPostById);

// Protegidos
router.post('/', requireAuth, createPost);
router.put('/:id', requireAuth, updatePost);
router.delete('/:id', requireAuth, deletePost);

// Miembros (protegidos)
router.post('/:id/join', requireAuth, joinPost);
router.put('/:id/members/:userId', requireAuth, handleMemberRequest);
router.delete('/:id/members/:userId', requireAuth, leavePost);

module.exports = router;
