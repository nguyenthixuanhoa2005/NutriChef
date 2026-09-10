'use strict';

const db = require('../config/db');
const { updateAchievementProgress } = require('../services/achievementService');

// POST /api/meal-sets/favorite
const saveFavoriteMealSet = async (req, res) => {
    const client = await db.getClient();

    try {
        const {
            name,
            targetCalories,
            mealType,
            goalType,
            imageUrl,
            recipeIds,
        } = req.body || {};

        const normalizedRecipeIds = [...new Set(
            (Array.isArray(recipeIds) ? recipeIds : [])
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        if (normalizedRecipeIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Danh sách món ăn không hợp lệ',
            });
        }

        const normalizedGoalInput = String(goalType || '').trim().toUpperCase();
        const goalTypeMap = {
            LOSE: 'LOSE_WEIGHT',
            LOSE_WEIGHT: 'LOSE_WEIGHT',
            MAINTAIN: 'MAINTAIN',
            GAIN: 'GAIN_WEIGHT',
            GAIN_WEIGHT: 'GAIN_WEIGHT',
        };
        const dbGoalType = goalTypeMap[normalizedGoalInput] || 'MAINTAIN';

        const targetCaloriesValue = Number(targetCalories);
        const sanitizedTargetCalories = Number.isFinite(targetCaloriesValue)
            ? Math.max(0, Math.round(targetCaloriesValue * 100) / 100)
            : null;

        await client.query('BEGIN');

        const recipeExistResult = await client.query(
            `SELECT COUNT(*)::int AS matched_count
             FROM recipe
             WHERE recipe_id = ANY($1::int[])`,
            [normalizedRecipeIds]
        );

        if (Number(recipeExistResult.rows[0]?.matched_count || 0) !== normalizedRecipeIds.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: 'Có món ăn không tồn tại trong hệ thống',
            });
        }

        const createdMealSet = await client.query(
            `INSERT INTO meal_set (name, target_calories, meal_type, user_id, image_url, goal_type)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING meal_set_id, name, target_calories, meal_type, user_id, image_url, goal_type, total_calories, created_at`,
            [
                String(name || '').trim() || 'Mâm cơm yêu thích',
                sanitizedTargetCalories,
                String(mealType || '').trim() || null,
                req.authUser.user_id,
                String(imageUrl || '').trim() || null,
                dbGoalType,
            ]
        );

        const mealSetId = createdMealSet.rows[0].meal_set_id;

        await client.query(
            `INSERT INTO meal_set_recipe (meal_set_id, recipe_id)
             SELECT $1, recipe_id
             FROM UNNEST($2::int[]) AS recipe_id
             ON CONFLICT (meal_set_id, recipe_id) DO NOTHING`,
            [mealSetId, normalizedRecipeIds]
        );

        await client.query(
            `INSERT INTO favorite_meal_set (user_id, meal_set_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, meal_set_id)
             DO UPDATE SET saved_at = CURRENT_TIMESTAMP`,
            [req.authUser.user_id, mealSetId]
        );

        await client.query('COMMIT');

        // Hook cập nhật thành tựu (sau khi commit thành công)
        updateAchievementProgress(req.authUser.user_id, 'MEAL_SET_COUNT').catch(console.error);

        const finalMealSet = await client.query(
            `SELECT meal_set_id, name, target_calories, total_calories, meal_type, goal_type, image_url, created_at
             FROM meal_set
             WHERE meal_set_id = $1
             LIMIT 1`,
            [mealSetId]
        );

        await client.query('COMMIT');

        return res.json({
            status: 'success',
            message: 'Đã lưu mâm cơm yêu thích',
            mealSet: finalMealSet.rows[0],
            recipeCount: normalizedRecipeIds.length,
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        console.error('❌ Lỗi API lưu meal set yêu thích:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi lưu mâm cơm yêu thích',
        });
    } finally {
        client.release();
    }
};

// GET /api/meal-sets/favorites
const getFavoriteMealSets = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                ms.meal_set_id,
                ms.name,
                ms.meal_type,
                ms.goal_type,
                ms.target_calories,
                ms.total_calories,
                ms.image_url,
                ms.created_at,
                fms.saved_at,
                COUNT(msr.recipe_id)::int AS recipe_count
             FROM favorite_meal_set fms
             JOIN meal_set ms ON ms.meal_set_id = fms.meal_set_id
             LEFT JOIN meal_set_recipe msr ON msr.meal_set_id = ms.meal_set_id
             WHERE fms.user_id = $1
             GROUP BY ms.meal_set_id, fms.saved_at
             ORDER BY COALESCE(fms.saved_at, ms.created_at) DESC`,
            [req.authUser.user_id]
        );

        return res.json({
            status: 'success',
            mealSets: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API meal-sets/favorites:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn mâm cơm yêu thích' });
    }
};

// GET /api/meal-sets/:id/recipes
const getMealSetRecipes = async (req, res) => {
    try {
        const mealSetId = Number(req.params.id);
        if (!Number.isInteger(mealSetId) || mealSetId <= 0) {
            return res.status(400).json({ error: 'ID mâm cơm không hợp lệ' });
        }

        const favoriteResult = await db.query(
            `SELECT 1
             FROM favorite_meal_set
             WHERE user_id = $1
               AND meal_set_id = $2
             LIMIT 1`,
            [req.authUser.user_id, mealSetId]
        );

        if (!favoriteResult.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy mâm cơm yêu thích' });
        }

        const recipesResult = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.difficulty,
                r.ingredients_json
             FROM meal_set_recipe msr
             JOIN recipe r ON r.recipe_id = msr.recipe_id
             WHERE msr.meal_set_id = $1
             ORDER BY r.recipe_id DESC`,
            [mealSetId]
        );

        return res.json({
            status: 'success',
            recipes: recipesResult.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API meal-sets/:id/recipes:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn món trong mâm cơm yêu thích' });
    }
};

module.exports = { saveFavoriteMealSet, getFavoriteMealSets, getMealSetRecipes };
