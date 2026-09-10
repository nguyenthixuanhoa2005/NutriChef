'use strict';

const express = require('express');
const router = express.Router();

const { upload } = require('../middlewares/upload');
const asyncHandler = require('../errors/asyncHandler');
const {
    detectIngredients,
    getAllIngredientsInternal,
} = require('../controllers/ingredientController');
const { getCloudinaryConfigSummary } = require('../services/cloudinaryService');
const { getPremiumPlans } = require('../controllers/paymentController');

// --- Public utility ---
router.get('/ping', (req, res) => res.json({ status: 'ok', message: 'Pong! Server is updated.' }));

// --- Internal endpoints ---
router.get('/internal/all-ingredients', getAllIngredientsInternal);
router.get('/internal/cloudinary-config', (req, res) => {
    const config = getCloudinaryConfigSummary();
    res.json({ status: 'success', cloudinary: config });
});

// --- AI ---
router.post('/ai/detect-ingredients', upload.single('file'), detectIngredients);

// --- Premium plans (standalone path, not under /payments) ---
router.get('/premium-plans', getPremiumPlans);

// --- Feature routes ---
router.use('/auth', require('./auth.routes'));
router.use('/recipes', require('./recipe.routes'));
router.use('/ingredients', require('./ingredient.routes'));
router.use('/meal-sets', require('./mealSet.routes'));
router.use('/achievements', require('./achievement.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/webhooks', require('./webhook.routes'));

// --- Admin routes ---
router.use('/admin/recipes', require('./admin/adminRecipe.routes'));
router.use('/admin/recipe-submissions', require('./admin/adminRecipeSubmission.routes'));
router.use('/admin/ingredients', require('./admin/adminIngredient.routes'));
router.use('/admin/users', require('./admin/adminUser.routes'));
router.use('/admin/payments', require('./admin/adminPayment.routes'));
router.use('/admin/upload', require('./admin/adminUpload.routes'));
router.use('/admin/stats', require('./admin/adminStats.routes'));

module.exports = router;
