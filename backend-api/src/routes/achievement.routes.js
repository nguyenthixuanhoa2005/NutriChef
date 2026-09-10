'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../errors/asyncHandler');
const { authenticateAccessToken } = require('../middlewares/auth');
const { getAchievements, equipTitle } = require('../controllers/achievementController');

router.get('/', authenticateAccessToken, asyncHandler(getAchievements));
router.post('/equip-title', authenticateAccessToken, asyncHandler(equipTitle));

module.exports = router;
