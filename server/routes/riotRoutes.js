const express = require('express');
const router = express.Router();
const { validateRiotId, getRiotRank } = require('../controllers/riotController');

// GET /api/riot/validate/:gameName/:tagLine
router.get('/validate/:gameName/:tagLine', validateRiotId);

// GET /api/riot/rank/:region/:gameName/:tagLine
router.get('/rank/:region/:gameName/:tagLine', getRiotRank);

module.exports = router;
