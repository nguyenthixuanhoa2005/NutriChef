'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../errors/asyncHandler');
const { authenticateAccessToken } = require('../../middlewares/auth');
const { upload } = require('../../middlewares/upload');
const { uploadRecipeImage, uploadIngredientImage } = require('../../controllers/admin/adminUploadController');
const { getStats } = require('../../controllers/admin/adminStatsController');

router.post('/recipe-image', authenticateAccessToken, upload.single('image'), asyncHandler(uploadRecipeImage));
router.post('/ingredient-image', authenticateAccessToken, upload.single('image'), asyncHandler(uploadIngredientImage));

module.exports = router;
