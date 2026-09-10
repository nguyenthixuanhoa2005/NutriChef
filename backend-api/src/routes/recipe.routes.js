'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../errors/asyncHandler');
const { authenticateAccessToken } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const {
    recommendRecipesByIngredientIds,
} = require('../services/recipeRecommendService');
const {
    createRecipeRecommendHandler,
} = require('../controllers/recipeRecommendController');
const {
    getTrending,
    getFavorites,
    getDetail,
    getRatings,
    submitRating,
    getFavoriteStatus,
    submitRecipe,
    getMySubmissions,
    addFavorite,
    removeFavorite,
} = require('../controllers/recipeController');

const db = require('../config/db');

// Public
router.get('/trending', getTrending);
router.get('/favorites', authenticateAccessToken, getFavorites);
// NOTE: /submissions/me must be before /:id to avoid route collision
router.get('/submissions/me', authenticateAccessToken, getMySubmissions);
router.get('/:id', getDetail);
router.get('/:id/ratings', getRatings);
router.get('/:id/favorite-status', authenticateAccessToken, getFavoriteStatus);

// Auth required
router.post('/recommend', createRecipeRecommendHandler(db, recommendRecipesByIngredientIds));
router.post('/submissions', authenticateAccessToken, upload.single('image'), submitRecipe);
router.post('/:id/ratings', authenticateAccessToken, submitRating);
router.post('/:id/favorite', authenticateAccessToken, addFavorite);
router.delete('/:id/favorite', authenticateAccessToken, removeFavorite);

module.exports = router;
