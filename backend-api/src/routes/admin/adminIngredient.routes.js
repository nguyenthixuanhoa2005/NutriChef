'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../errors/asyncHandler');
const { authenticateAccessToken } = require('../../middlewares/auth');
const { upload } = require('../../middlewares/upload');
const {
    listIngredients,
    createIngredient,
    updateIngredient,
    deleteIngredient,
} = require('../../controllers/admin/adminIngredientController');

router.get('/', authenticateAccessToken, asyncHandler(listIngredients));
router.post('/', authenticateAccessToken, asyncHandler(createIngredient));
router.put('/:id', authenticateAccessToken, asyncHandler(updateIngredient));
router.delete('/:id', authenticateAccessToken, asyncHandler(deleteIngredient));

module.exports = router;
