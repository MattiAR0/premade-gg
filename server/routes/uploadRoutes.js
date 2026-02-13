const express = require('express');
const router = express.Router();
const { uploadAvatar } = require('../controllers/uploadController');
const { requireAuth } = require('../middlewares/auth');

router.post('/avatar', requireAuth, ...uploadAvatar);

module.exports = router;
