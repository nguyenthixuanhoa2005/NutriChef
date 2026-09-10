'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../errors/asyncHandler');
const { authenticateAccessToken } = require('../middlewares/auth');
const { getPremiumPlans, createPayment, getPaymentStatus } = require('../controllers/paymentController');

router.get('/premium-plans', getPremiumPlans);
router.post('/', authenticateAccessToken, asyncHandler(createPayment));
router.get('/:id/status', authenticateAccessToken, asyncHandler(getPaymentStatus));

module.exports = router;
