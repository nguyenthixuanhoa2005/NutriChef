'use strict';

const express = require('express');
const router = express.Router();
const { upload } = require('../middlewares/upload');
const {
    detectIngredients,
    getAllIngredientsInternal,
    getIngredients,
} = require('../controllers/ingredientController');

// Public
router.get('/', getIngredients);

module.exports = router;
