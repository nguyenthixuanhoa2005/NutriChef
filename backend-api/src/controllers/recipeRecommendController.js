const {
    recommendRecipesByIngredientIds,
} = require('../services/recipeRecommendService');

const createRecipeRecommendHandler = (dbClient, recommendFn = recommendRecipesByIngredientIds) => {
    return async (req, res) => {
        try {
            const { ingredient_ids } = req.body || {};
            const rows = await recommendFn(dbClient, ingredient_ids);

            return res.json({
                status: 'success',
                total_found: rows.length,
                recipes: rows,
            });
        } catch (error) {
            if (error?.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }

            console.error('❌ Lỗi API Gợi ý:', error?.message || error);
            return res.status(500).json({ error: 'Lỗi truy vấn món ăn' });
        }
    };
};

module.exports = {
    createRecipeRecommendHandler,
};
