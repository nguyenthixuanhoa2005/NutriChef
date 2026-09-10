'use strict';

const express = require('express');
const router = express.Router();
const { authenticateAccessToken } = require('../../middlewares/auth');
const {
    listSubmissions,
    reviewSubmission,
} = require('../../controllers/admin/adminRecipeController');

router.get('/', authenticateAccessToken, listSubmissions);
router.patch('/:id/review', authenticateAccessToken, reviewSubmission);

module.exports = router;
