'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../errors/asyncHandler');
const { authenticateAccessToken } = require('../../middlewares/auth');
const { getStats } = require('../../controllers/admin/adminStatsController');

router.get('/', authenticateAccessToken, asyncHandler(getStats));

module.exports = router;
