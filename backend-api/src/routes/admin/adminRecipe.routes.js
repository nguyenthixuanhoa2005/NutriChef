'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../errors/asyncHandler');
const { authenticateAccessToken } = require('../../middlewares/auth');
const {
    listRecipes,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    listSubmissions,
    reviewSubmission,
} = require('../../controllers/admin/adminRecipeController');

router.get('/', authenticateAccessToken, asyncHandler(listRecipes));
router.post('/', authenticateAccessToken, asyncHandler(createRecipe));
router.put('/:id', authenticateAccessToken, asyncHandler(updateRecipe));
router.delete('/:id', authenticateAccessToken, asyncHandler(deleteRecipe));

// Recipe submissions
router.get('/submissions', authenticateAccessToken, listSubmissions);
router.patch('/submissions/:id/review', authenticateAccessToken, reviewSubmission);

module.exports = router;
