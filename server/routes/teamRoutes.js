const express = require('express');
const router = express.Router();
const {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  setCoach,
  addPlayer,
  removePlayer,
  addStaff,
  removeStaff,
} = require('../controllers/teamController');
const { requireAuth } = require('../middlewares/auth');

// Públicos
router.get('/', getTeams);
router.get('/:id', getTeamById);

// Protegidos
router.post('/', requireAuth, createTeam);
router.put('/:id', requireAuth, updateTeam);
router.delete('/:id', requireAuth, deleteTeam);

// Coach
router.put('/:id/coach', requireAuth, setCoach);

// Jugadores
router.post('/:id/players', requireAuth, addPlayer);
router.delete('/:id/players/:userId', requireAuth, removePlayer);

// Staff
router.post('/:id/staff', requireAuth, addStaff);
router.delete('/:id/staff/:userId', requireAuth, removeStaff);

module.exports = router;
