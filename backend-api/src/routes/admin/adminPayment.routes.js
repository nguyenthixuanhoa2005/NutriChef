'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../errors/asyncHandler');
const { authenticateAccessToken } = require('../../middlewares/auth');
const { listPayments } = require('../../controllers/admin/adminPaymentController');

router.get('/', authenticateAccessToken, asyncHandler(listPayments));

module.exports = router;
