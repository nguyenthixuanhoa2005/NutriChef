'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../errors/asyncHandler');
const { authenticateAccessToken } = require('../middlewares/auth');
const {
    register,
    login,
    refresh,
    logout,
    socialGoogle,
    getMe,
} = require('../controllers/authController');

router.post('/register', asyncHandler(register));
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/social/google', socialGoogle);
router.get('/me', authenticateAccessToken, getMe);

module.exports = router;
