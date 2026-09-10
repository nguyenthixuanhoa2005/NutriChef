'use strict';

const db = require('../config/db');
const AppError = require('../errors/AppError');
const {
    capitalizeWords,
    normalizeDishType,
    normalizeDifficulty,
    parsePositiveNumber,
    parsePositiveInteger,
    parseJsonArrayInput,
    safeUnlink,
    normalizeIngredientsJson,
    enrichIngredientsWithIds,
    normalizeStepsJson,
} = require('../utils/recipeUtils');
const {
    ensureRecipeSubmissionTableReady,
} = require('../services/dbSetupService');
const {
    updateAchievementProgress,
} = require('../services/achievementService');
const {
    uploadImageFromPath,
} = require('../services/cloudinaryService');

// GET /api/recipes/trending
const getTrending = async (req, res) => {
    try {
        const { dishType } = req.query;
        const parsedLimit = Number(req.query.limit || 20);
        const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 20;

        let query = `
            SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.dish_type,
                r.difficulty,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr.user_id) AS like_count
            FROM recipe r
            LEFT JOIN app_user u ON u.user_id = r.author_id
            LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
            LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
            WHERE r.status = 'APPROVED'
        `;

        const queryParams = [];
        if (dishType) {
            query += ` AND r.dish_type = $1`;
            queryParams.push(dishType.toUpperCase());
        }

        query += `
            GROUP BY r.recipe_id, u.full_name
            ORDER BY
                (CASE WHEN r.created_at >= NOW() - INTERVAL '48 hours' THEN 1 ELSE 0 END) DESC,
                avg_rating DESC,
                like_count DESC,
                r.recipe_id DESC
            LIMIT $${queryParams.length + 1}
        `;
        queryParams.push(limit);

        const result = await db.query(query, queryParams);

        res.json({
            status: 'success',
            recipes: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API recipes/trending:', error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách công thức' });
    }
};

// GET /api/recipes/favorites
const getFavorites = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.difficulty,
                r.ingredients_json,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr2.user_id) AS like_count
             FROM favorite_recipe fr
             JOIN recipe r ON r.recipe_id = fr.recipe_id
             LEFT JOIN app_user u ON u.user_id = r.author_id
             LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
             LEFT JOIN favorite_recipe fr2 ON fr2.recipe_id = r.recipe_id
             WHERE fr.user_id = $1
             GROUP BY r.recipe_id, u.full_name
             ORDER BY r.recipe_id DESC`,
            [req.authUser.user_id]
        );

        return res.json({
            status: 'success',
            recipes: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API recipes/favorites:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn công thức yêu thích' });
    }
};

// GET /api/recipes/:id
const getDetail = async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const result = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.ingredients_json,
                r.steps_json,
                r.dish_type,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.difficulty,
                r.created_at,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr.user_id) AS like_count
             FROM recipe r
             LEFT JOIN app_user u ON u.user_id = r.author_id
             LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
             LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
             WHERE r.recipe_id = $1
             GROUP BY r.recipe_id, u.full_name
             LIMIT 1`,
            [recipeId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        return res.json({
            status: 'success',
            recipe: result.rows[0],
        });
    } catch (error) {
        console.error('❌ Lỗi API recipe detail:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn chi tiết công thức' });
    }
};

// GET /api/recipes/:id/ratings
const getRatings = async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        const result = await db.query(
            `SELECT
                r.rating_id,
                r.score,
                r.comment,
                r.created_at,
                u.full_name,
                u.avatar_url
             FROM rating r
             JOIN app_user u ON r.user_id = u.user_id
             WHERE r.recipe_id = $1
             ORDER BY r.created_at DESC`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            ratings: result.rows
        });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách đánh giá:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn danh sách đánh giá' });
    }
};

// POST /api/recipes/:id/ratings
const submitRating = async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        const userId = req.authUser.user_id;
        const { score, comment } = req.body;

        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5' });
        }

        // Kiểm tra xem đã đánh giá chưa
        const existingRating = await db.query(
            'SELECT rating_id FROM rating WHERE user_id = $1 AND recipe_id = $2',
            [userId, recipeId]
        );

        if (existingRating.rows.length > 0) {
            // Cập nhật
            await db.query(
                'UPDATE rating SET score = $1, comment = $2, created_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND recipe_id = $4',
                [score, comment, userId, recipeId]
            );
        } else {
            // Thêm mới
            await db.query(
                'INSERT INTO rating (user_id, recipe_id, score, comment) VALUES ($1, $2, $3, $4)',
                [userId, recipeId, score, comment]
            );
        }

        // Hook cập nhật thành tựu
        updateAchievementProgress(userId, 'REVIEW_COUNT').catch(console.error);

        // Lấy lại thông số trung bình để trả về cập nhật UI
        const stats = await db.query(
            `SELECT
                COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_rating,
                COUNT(*) AS rating_count
             FROM rating
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            message: 'Đánh giá thành công',
            avg_rating: stats.rows[0].avg_rating,
            rating_count: stats.rows[0].rating_count
        });
    } catch (error) {
        console.error('❌ Lỗi gửi đánh giá:', error.message);
        return res.status(500).json({ error: 'Lỗi hệ thống khi gửi đánh giá' });
    }
};

// GET /api/recipes/:id/favorite-status
const getFavoriteStatus = async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const result = await db.query(
            `SELECT 1
             FROM favorite_recipe
             WHERE user_id = $1
               AND recipe_id = $2
             LIMIT 1`,
            [req.authUser.user_id, recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: result.rows.length > 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API favorite-status:', error.message);
        return res.status(500).json({ error: 'Lỗi kiểm tra trạng thái yêu thích' });
    }
};

// POST /api/recipes/submissions
const submitRecipe = async (req, res) => {
    const uploadedTempImagePath = req.file?.path || null;
    try {
        await ensureRecipeSubmissionTableReady();

        const {
            title,
            description,
            ingredients_json,
            steps_json,
            dish_type,
            image_url,
            total_calories,
            cooking_time,
            difficulty,
        } = req.body || {};

        const normalizedTitle = capitalizeWords(title || '');
        if (!normalizedTitle) {
            return res.status(400).json({ status: 'error', message: 'Tiêu đề công thức là bắt buộc' });
        }

        const normalizedIngredients = normalizeIngredientsJson(parseJsonArrayInput(ingredients_json));
        if (normalizedIngredients.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Danh sách nguyên liệu là bắt buộc' });
        }

        const normalizedSteps = normalizeStepsJson(parseJsonArrayInput(steps_json));
        if (normalizedSteps.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Các bước thực hiện là bắt buộc' });
        }

        const normalizedDishType = normalizeDishType(dish_type);
        if (!normalizedDishType) {
            return res.status(400).json({ status: 'error', message: 'Loại món phải là MAIN_DISH, SIDE_DISH hoặc DESSERT' });
        }

        const normalizedDifficulty = normalizeDifficulty(difficulty);
        if (!normalizedDifficulty) {
            return res.status(400).json({ status: 'error', message: 'Độ khó phải là EASY, MEDIUM hoặc HARD' });
        }

        const normalizedTotalCalories = parsePositiveNumber(total_calories);
        if (normalizedTotalCalories === null) {
            return res.status(400).json({ status: 'error', message: 'Calories phải là số lớn hơn 0' });
        }

        const normalizedCookingTime = parsePositiveInteger(cooking_time);
        if (normalizedCookingTime === null) {
            return res.status(400).json({ status: 'error', message: 'Thời gian nấu phải là số nguyên lớn hơn 0 (phút)' });
        }

        const insertResult = await db.query(
            `INSERT INTO recipe_submission (
                submitter_id,
                title,
                description,
                ingredients_json,
                steps_json,
                dish_type,
                image_url,
                temp_image_path,
                total_calories,
                cooking_time,
                difficulty,
                status,
                created_at,
                updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            RETURNING submission_id, status, created_at`,
            [
                req.authUser.user_id,
                normalizedTitle,
                String(description || '').trim() || null,
                JSON.stringify(normalizedIngredients),
                JSON.stringify(normalizedSteps),
                normalizedDishType,
                uploadedTempImagePath ? null : (String(image_url || '').trim() || null),
                uploadedTempImagePath,
                normalizedTotalCalories,
                normalizedCookingTime,
                normalizedDifficulty,
            ]
        );

        return res.status(201).json({
            status: 'success',
            message: 'Đã gửi công thức chờ admin duyệt',
            submission: insertResult.rows[0],
        });
    } catch (error) {
        if (uploadedTempImagePath) {
            safeUnlink(uploadedTempImagePath);
        }
        console.error('❌ Lỗi tạo recipe submission:', error.message);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi gửi công thức' });
    }
};

// GET /api/recipes/submissions/me
const getMySubmissions = async (req, res) => {
    try {
        await ensureRecipeSubmissionTableReady();

        const result = await db.query(
            `SELECT
                rs.submission_id,
                rs.title,
                rs.description,
                rs.status,
                rs.reject_reason,
                rs.created_at,
                rs.reviewed_at,
                rs.linked_recipe_id,
                rs.total_calories,
                rs.cooking_time,
                rs.difficulty,
                rs.dish_type
             FROM recipe_submission rs
             WHERE rs.submitter_id = $1
             ORDER BY rs.created_at DESC`,
            [req.authUser.user_id]
        );

        return res.json({ status: 'success', submissions: result.rows });
    } catch (error) {
        console.error('❌ Lỗi lấy recipe submission của user:', error.message);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi tải trạng thái duyệt' });
    }
};

// POST /api/recipes/:id/favorite
const addFavorite = async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const recipeResult = await db.query(
            `SELECT recipe_id
             FROM recipe
             WHERE recipe_id = $1
             LIMIT 1`,
            [recipeId]
        );
        if (!recipeResult.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        await db.query(
            `INSERT INTO favorite_recipe (user_id, recipe_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, recipe_id) DO NOTHING`,
            [req.authUser.user_id, recipeId]
        );

        // Hook cập nhật thành tựu
        updateAchievementProgress(req.authUser.user_id, 'FAVORITE_COUNT').catch(console.error);

        const likeCountResult = await db.query(
            `SELECT COUNT(*)::int AS like_count
             FROM favorite_recipe
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: true,
            likeCount: likeCountResult.rows[0]?.like_count || 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API add favorite:', error.message);
        return res.status(500).json({ error: 'Lỗi thêm yêu thích công thức' });
    }
};

// DELETE /api/recipes/:id/favorite
const removeFavorite = async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        await db.query(
            `DELETE FROM favorite_recipe
             WHERE user_id = $1
               AND recipe_id = $2`,
            [req.authUser.user_id, recipeId]
        );

        const likeCountResult = await db.query(
            `SELECT COUNT(*)::int AS like_count
             FROM favorite_recipe
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: false,
            likeCount: likeCountResult.rows[0]?.like_count || 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API remove favorite:', error.message);
        return res.status(500).json({ error: 'Lỗi bỏ yêu thích công thức' });
    }
};

module.exports = {
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
};
