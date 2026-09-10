'use strict';

const db = require('../../config/db');
const AppError = require('../../errors/AppError');
const { ensureAdminRole } = require('../../middlewares/auth');
const {
    capitalizeWords,
    normalizeDishType,
    normalizeDifficulty,
    parsePositiveNumber,
    parsePositiveInteger,
    normalizeIngredientsJson,
    enrichIngredientsWithIds,
    normalizeStepsJson,
    safeUnlink,
} = require('../../utils/recipeUtils');
const {
    ensureRecipeSubmissionTableReady,
} = require('../../services/dbSetupService');
const {
    updateAchievementProgress,
} = require('../../services/achievementService');
const {
    uploadImageFromPath,
} = require('../../services/cloudinaryService');

// GET /api/admin/recipes
const listRecipes = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const result = await db.query(
       `SELECT
           r.recipe_id,
           r.title,
           r.description,
           r.ingredients_json,
           r.steps_json,
           r.image_url,
           r.total_calories,
           r.cooking_time,
           r.difficulty,
           r.dish_type,
           r.status,
           r.created_at,
           COALESCE(u.full_name, 'NutriChef') AS author_name,
           COUNT(DISTINCT msr.meal_set_id)::int AS in_meal_set_count,
           COUNT(DISTINCT fr.user_id)::int AS favorite_count
        FROM recipe r
        LEFT JOIN app_user u ON u.user_id = r.author_id
        LEFT JOIN meal_set_recipe msr ON msr.recipe_id = r.recipe_id
        LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
        WHERE r.status != 'HIDDEN'
        GROUP BY r.recipe_id, u.full_name
        ORDER BY r.created_at DESC, r.recipe_id DESC`
    );
    res.json({ status: 'success', recipes: result.rows });
};

// POST /api/admin/recipes
const createRecipe = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

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
        throw new AppError('Tên công thức là bắt buộc', 400);
    }

    const normalizedIngredients = normalizeIngredientsJson(ingredients_json);
    if (normalizedIngredients.length === 0) {
        throw new AppError('Danh sách nguyên liệu là bắt buộc', 400);
    }

    const normalizedSteps = normalizeStepsJson(steps_json);
    if (normalizedSteps.length === 0) {
        throw new AppError('Các bước thực hiện là bắt buộc', 400);
    }

    const normalizedDishType = normalizeDishType(dish_type);
    if (!normalizedDishType) {
        throw new AppError('Loại món phải là MAIN_DISH, SIDE_DISH hoặc DESSERT', 400);
    }

    const normalizedDifficulty = normalizeDifficulty(difficulty);
    if (!normalizedDifficulty) {
        throw new AppError('Độ khó phải là EASY, MEDIUM hoặc HARD', 400);
    }

    const normalizedTotalCalories = parsePositiveNumber(total_calories);
    if (normalizedTotalCalories === null) {
        throw new AppError('Calories phải là số lớn hơn 0', 400);
    }

    const normalizedCookingTime = parsePositiveInteger(cooking_time);
    if (normalizedCookingTime === null) {
        throw new AppError('Thời gian nấu phải là số nguyên lớn hơn 0 (phút)', 400);
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const normalizedIngredientsWithIds = await enrichIngredientsWithIds(client, normalizedIngredients);

        const inserted = await client.query(
            `INSERT INTO recipe (
                author_id,
                title,
                description,
                ingredients_json,
                steps_json,
                dish_type,
                image_url,
                total_calories,
                cooking_time,
                difficulty,
                status,
                created_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'APPROVED',CURRENT_TIMESTAMP)
            RETURNING recipe_id, title, description, image_url, total_calories, cooking_time, difficulty, dish_type, created_at`,
            [
                req.authUser.user_id,
                normalizedTitle,
                String(description || '').trim() || null,
                JSON.stringify(normalizedIngredientsWithIds),
                JSON.stringify(normalizedSteps),
                normalizedDishType,
                image_url || null,
                normalizedTotalCalories,
                normalizedCookingTime,
                normalizedDifficulty,
            ]
        );

        const recipeId = inserted.rows[0].recipe_id;
        const ingredientIds = normalizedIngredientsWithIds
            .map((item) => Number(item?.id || item?.ingredient_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (ingredientIds.length > 0) {
            await client.query(
                `INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
                 SELECT $1, ingredient_id
                 FROM UNNEST($2::int[]) AS ingredient_id
                 ON CONFLICT (recipe_id, ingredient_id) DO NOTHING`,
                [recipeId, [...new Set(ingredientIds)]]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ status: 'success', recipe: inserted.rows[0] });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
    } finally {
        client.release();
    }
};

// PUT /api/admin/recipes/:id
const updateRecipe = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID không hợp lệ', 400);

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
    if (!normalizedTitle) throw new AppError('Tên công thức là bắt buộc', 400);

    const normalizedIngredients = normalizeIngredientsJson(ingredients_json);
    const normalizedSteps = normalizeStepsJson(steps_json);
    const normalizedDishType = normalizeDishType(dish_type);
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const normalizedTotalCalories = parsePositiveNumber(total_calories);
    const normalizedCookingTime = parsePositiveInteger(cooking_time);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const normalizedIngredientsWithIds = await enrichIngredientsWithIds(client, normalizedIngredients);

        const updateResult = await client.query(
            `UPDATE recipe
             SET title = $1, description = $2, ingredients_json = $3, steps_json = $4,
                 dish_type = $5, image_url = $6, total_calories = $7,
                 cooking_time = $8, difficulty = $9
             WHERE recipe_id = $10
             RETURNING recipe_id`,
            [
                normalizedTitle,
                description || null,
                JSON.stringify(normalizedIngredientsWithIds),
                JSON.stringify(normalizedSteps),
                normalizedDishType,
                image_url || null,
                normalizedTotalCalories,
                normalizedCookingTime,
                normalizedDifficulty,
                id
            ]
        );

        if (updateResult.rows.length === 0) {
            throw new AppError('Công thức không tồn tại', 404);
        }

        // Update ingredient mapping
        await client.query('DELETE FROM recipe_ingredient_map WHERE recipe_id = $1', [id]);
        const ingredientIds = normalizedIngredientsWithIds
            .map((item) => Number(item?.id || item?.ingredient_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (ingredientIds.length > 0) {
            await client.query(
                `INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
                 SELECT $1, ingredient_id
                 FROM UNNEST($2::int[]) AS ingredient_id
                 ON CONFLICT (recipe_id, ingredient_id) DO NOTHING`,
                [id, [...new Set(ingredientIds)]]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'success', recipeId: id });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// DELETE /api/admin/recipes/:id
const deleteRecipe = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID không hợp lệ', 400);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE recipe
             SET status = 'HIDDEN'
             WHERE recipe_id = $1
             RETURNING recipe_id`,
            [id]
        );

        if (result.rows.length === 0) {
            throw new AppError('Công thức không tồn tại', 404);
        }

        await client.query('COMMIT');
        res.json({ status: 'success', message: 'Đã ẩn công thức' });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// GET /api/admin/recipe-submissions
const listSubmissions = async (req, res) => {
    try {
        if (!(await ensureAdminRole(req, res))) {
            return;
        }

        await ensureRecipeSubmissionTableReady();

        const statusFilterRaw = String(req.query.status || 'ALL').trim().toUpperCase();
        const allowedStatuses = new Set(['ALL', 'PENDING', 'APPROVED', 'REJECTED']);
        const statusFilter = allowedStatuses.has(statusFilterRaw) ? statusFilterRaw : 'ALL';

        const query = statusFilter === 'ALL'
            ? `SELECT
                    rs.submission_id,
                    rs.submitter_id,
                    rs.title,
                    rs.description,
                    rs.ingredients_json,
                    rs.steps_json,
                    rs.dish_type,
                    rs.image_url,
                    rs.total_calories,
                    rs.cooking_time,
                    rs.difficulty,
                    rs.status,
                    rs.reject_reason,
                    rs.reviewed_by,
                    rs.reviewed_at,
                    rs.linked_recipe_id,
                    rs.created_at,
                    COALESCE(u.full_name, u.email, 'Người dùng') AS submitter_name
               FROM recipe_submission rs
               LEFT JOIN app_user u ON u.user_id = rs.submitter_id
               ORDER BY rs.created_at DESC`
            : `SELECT
                    rs.submission_id,
                    rs.submitter_id,
                    rs.title,
                    rs.description,
                    rs.ingredients_json,
                    rs.steps_json,
                    rs.dish_type,
                    rs.image_url,
                    rs.total_calories,
                    rs.cooking_time,
                    rs.difficulty,
                    rs.status,
                    rs.reject_reason,
                    rs.reviewed_by,
                    rs.reviewed_at,
                    rs.linked_recipe_id,
                    rs.created_at,
                    COALESCE(u.full_name, u.email, 'Người dùng') AS submitter_name
               FROM recipe_submission rs
               LEFT JOIN app_user u ON u.user_id = rs.submitter_id
               WHERE rs.status = $1
               ORDER BY rs.created_at DESC`;

        const result = statusFilter === 'ALL'
            ? await db.query(query)
            : await db.query(query, [statusFilter]);

        return res.json({ status: 'success', submissions: result.rows });
    } catch (error) {
        console.error('❌ Lỗi lấy admin recipe submissions:', error.message);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi tải danh sách chờ duyệt' });
    }
};

// PATCH /api/admin/recipe-submissions/:id/review
const reviewSubmission = async (req, res) => {
    const client = await db.getClient();
    try {
        if (!(await ensureAdminRole(req, res))) {
            return;
        }

        await ensureRecipeSubmissionTableReady();

        const submissionId = Number(req.params.id);
        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return res.status(400).json({ status: 'error', message: 'ID submission không hợp lệ' });
        }

        const action = String(req.body?.action || '').trim().toUpperCase();
        const rejectReason = String(req.body?.reject_reason || '').trim();

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ status: 'error', message: 'Action phải là APPROVE hoặc REJECT' });
        }

        await client.query('BEGIN');

        const submissionResult = await client.query(
            `SELECT *
             FROM recipe_submission
             WHERE submission_id = $1
             LIMIT 1`,
            [submissionId]
        );

        const submission = submissionResult.rows[0];
        if (!submission) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy submission' });
        }

        if (String(submission.status || '').toUpperCase() !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: 'Submission đã được xử lý trước đó' });
        }

        if (action === 'REJECT') {
            const tempImageToDelete = submission.temp_image_path || null;
            const rejected = await client.query(
                `UPDATE recipe_submission
                 SET status = 'REJECTED',
                     reject_reason = $2,
                     reviewed_by = $3,
                     reviewed_at = CURRENT_TIMESTAMP,
                     temp_image_path = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE submission_id = $1
                 RETURNING submission_id, status, reject_reason, reviewed_at`,
                [submissionId, rejectReason || 'Không đạt yêu cầu kiểm duyệt', req.authUser.user_id]
            );

            await client.query('COMMIT');
            safeUnlink(tempImageToDelete);
            return res.json({ status: 'success', submission: rejected.rows[0] });
        }

        let approvedImageUrl = submission.image_url || null;
        if (submission.temp_image_path) {
            const uploadedImage = await uploadImageFromPath({
                filePath: submission.temp_image_path,
                scope: 'recipes',
                entityId: `submission-${submission.submission_id}`,
                suffix: Date.now(),
            });
            approvedImageUrl = uploadedImage.imageUrl;
        }

        const approvedTitle = capitalizeWords(submission.title || '');
        const approvedIngredientsRaw = normalizeIngredientsJson(submission.ingredients_json);
        const approvedIngredients = await enrichIngredientsWithIds(client, approvedIngredientsRaw);
        const approvedSteps = normalizeStepsJson(submission.steps_json);
        const approvedDishType = normalizeDishType(submission.dish_type);
        const approvedDifficulty = normalizeDifficulty(submission.difficulty);
        const approvedCalories = parsePositiveNumber(submission.total_calories);
        const approvedCookingTime = parsePositiveInteger(submission.cooking_time);

        // Allow approving legacy submissions that may miss optional metadata.
        if (!approvedTitle || approvedIngredients.length === 0 || approvedSteps.length === 0) {
            throw new AppError('Submission thiếu tiêu đề, nguyên liệu hoặc bước nấu nên chưa thể duyệt.', 422);
        }

        const createdRecipe = await client.query(
            `INSERT INTO recipe (
                author_id,
                title,
                description,
                ingredients_json,
                steps_json,
                dish_type,
                image_url,
                total_calories,
                cooking_time,
                difficulty,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING recipe_id`,
            [
                submission.submitter_id,
                approvedTitle,
                submission.description,
                JSON.stringify(approvedIngredients),
                JSON.stringify(approvedSteps),
                approvedDishType,
                approvedImageUrl,
                approvedCalories,
                approvedCookingTime,
                approvedDifficulty,
                'APPROVED'
            ]
        );

        const newRecipeId = createdRecipe.rows[0].recipe_id;
        const ingredientIds = approvedIngredients
            .map((item) => Number(item?.id || item?.ingredient_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (ingredientIds.length > 0) {
            await client.query(
                `INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
                 SELECT $1, ingredient_id
                 FROM UNNEST($2::int[]) AS ingredient_id
                 ON CONFLICT (recipe_id, ingredient_id) DO NOTHING`,
                [newRecipeId, [...new Set(ingredientIds)]]
            );
        }

        const approved = await client.query(
            `UPDATE recipe_submission
             SET status = 'APPROVED',
                 reviewed_by = $2,
                 reviewed_at = CURRENT_TIMESTAMP,
                 linked_recipe_id = $3,
                 image_url = $4,
                 temp_image_path = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE submission_id = $1
             RETURNING submission_id, status, linked_recipe_id, reviewed_at`,
            [submissionId, req.authUser.user_id, newRecipeId, approvedImageUrl]
        );

        await client.query('COMMIT');
        safeUnlink(submission.temp_image_path);

        // Hook cập nhật thành tựu (không đợi vì không muốn làm chậm response)
        updateAchievementProgress(submission.submitter_id, 'RECIPE_COUNT').catch(console.error);

        return res.json({ status: 'success', submission: approved.rows[0] });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        console.error('❌ Lỗi review recipe submission:', error.message);
        const statusCode = Number(error?.statusCode) || 500;
        return res.status(statusCode).json({
            status: 'error',
            message: statusCode >= 500 ? 'Lỗi server khi duyệt công thức' : (error.message || 'Không thể duyệt công thức'),
        });
    } finally {
        client.release();
    }
};

module.exports = { listRecipes, createRecipe, updateRecipe, deleteRecipe, listSubmissions, reviewSubmission };
