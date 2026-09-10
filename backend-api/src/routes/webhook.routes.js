'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../errors/asyncHandler');
const { sepayWebhook } = require('../controllers/webhookController');

router.post('/sepay', asyncHandler(sepayWebhook));

module.exports = router;
