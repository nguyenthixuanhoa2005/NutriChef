'use strict';

const express = require('express');
const router = express.Router();
const { authenticateAccessToken } = require('../middlewares/auth');
const {
    saveFavoriteMealSet,
    getFavoriteMealSets,
    getMealSetRecipes,
} = require('../controllers/mealSetController');

router.post('/favorite', authenticateAccessToken, saveFavoriteMealSet);
router.get('/favorites', authenticateAccessToken, getFavoriteMealSets);
router.get('/:id/recipes', authenticateAccessToken, getMealSetRecipes);

module.exports = router;
