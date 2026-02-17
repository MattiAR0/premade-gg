const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  recalculateKarma,
  searchUsers,
} = require('../controllers/userController');
const { requireAuth } = require('../middlewares/auth');

// Públicos
router.get('/search', searchUsers); // Debe estar ANTES de /:id
router.get('/', getUsers);
router.get('/:id', getUserById);
router.get('/:id/karma', recalculateKarma);

// Protegidos
router.post('/', requireAuth, createUser);
router.put('/:id', requireAuth, updateUser);
router.delete('/:id', requireAuth, deleteUser);

module.exports = router;
