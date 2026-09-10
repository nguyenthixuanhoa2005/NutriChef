'use strict';

const db = require('../../config/db');
const AppError = require('../../errors/AppError');
const { ensureAdminRole } = require('../../middlewares/auth');
const { ensureIngredientSoftDeleteReady, INGREDIENT_STATUS_ACTIVE, INGREDIENT_STATUS_HIDDEN } = require('../../services/dbSetupService');
const { addIngredient } = require('../../services/adminIngredientService');

// GET /api/admin/ingredients
const listIngredients = async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const result = await db.query(
        `SELECT ingredient_id, name, type, image_url, is_common, keywords, status
         FROM ingredient
         WHERE status = $1
         ORDER BY ingredient_id ASC`,
        [INGREDIENT_STATUS_ACTIVE]
    );
    console.log(`✅ Lấy danh sách nguyên liệu: ${result.rows.length} items`);
    res.json({ status: 'success', ingredients: result.rows });
};

// POST /api/admin/ingredients
const createIngredient = async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    try {
        console.log('📥 POST /api/admin/ingredients - Received body:', JSON.stringify(req.body));
        const ingredient = await addIngredient(db, req.body || {});
        console.log(`✅ Thêm nguyên liệu mới: ID ${ingredient.ingredient_id} - ${ingredient.name}`);
        res.status(201).json({ status: 'success', ingredient });
    } catch (error) {
        console.error('❌ Lỗi thêm nguyên liệu:', error.message, error);
        throw error;
    }
};

// PUT /api/admin/ingredients/:id
const updateIngredient = async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const id = Number(req.params.id);
    console.log(`📥 PUT /api/admin/ingredients/${id} - ID:`, id, ', Body:', JSON.stringify(req.body));

    if (!Number.isInteger(id) || id <= 0) {
        console.warn(`❌ Sửa nguyên liệu: ID không hợp lệ - ${id}`);
        throw new AppError('ID nguyen lieu khong hop le', 400);
    }

    const { name, type, image_url, is_common, keywords } = req.body || {};
    console.log(`   Fields - name: "${name}", type: "${type}", is_common: ${is_common}, keywords: "${keywords}"`);

    if (!name || !type) {
        console.warn(`❌ Sửa nguyên liệu ${id}: Thiếu name hoặc type`);
        throw new AppError('Ten va loai nguyen lieu la bat buoc', 400);
    }

    const VALID_TYPES = ['MEAT', 'VEGETABLE', 'SPICE', 'FRUIT', 'STARCH', 'OTHER'];
    if (!VALID_TYPES.includes(type)) {
        console.warn(`❌ Sửa nguyên liệu ${id}: Type không hợp lệ - ${type}`);
        throw new AppError('Loai nguyen lieu khong hop le', 400);
    }

    const result = await db.query(
        `UPDATE ingredient
         SET name = $1, type = $2, image_url = $3, is_common = $4, keywords = $5
         WHERE ingredient_id = $6
           AND status = $7
         RETURNING ingredient_id, name, type, image_url, is_common, keywords, status`,
        [String(name).trim(), type, image_url || null, Boolean(is_common), keywords ? String(keywords).trim() : null, id, INGREDIENT_STATUS_ACTIVE]
    );

    if (!result.rows.length) {
        console.warn(`❌ Sửa nguyên liệu: Không tìm thấy ID ${id} với status ACTIVE`);
        // Kiểm tra xem ingredient có tồn tại không (dù status khác)
        const checkResult = await db.query(
            `SELECT ingredient_id, status FROM ingredient WHERE ingredient_id = $1`,
            [id]
        );
        if (!checkResult.rows.length) {
            console.warn(`   → Ingredient ${id} không tồn tại trong DB`);
        } else {
            console.warn(`   → Ingredient ${id} tồn tại nhưng status = ${checkResult.rows[0].status}`);
        }
        throw new AppError('Nguyen lieu khong ton tai', 404);
    }

    console.log(`✅ Sửa nguyên liệu ${id} thành công`);
    res.json({ status: 'success', ingredient: result.rows[0] });
};

// DELETE /api/admin/ingredients/:id
const deleteIngredient = async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID nguyen lieu khong hop le', 400);

    const result = await db.query(
        `UPDATE ingredient
         SET status = $1
         WHERE ingredient_id = $2
           AND status = $3
         RETURNING ingredient_id, status`,
        [INGREDIENT_STATUS_HIDDEN, id, INGREDIENT_STATUS_ACTIVE]
    );

    if (!result.rows.length) throw new AppError('Nguyen lieu khong ton tai', 404);
    res.json({
        status: 'success',
        ingredientId: result.rows[0].ingredient_id,
        ingredientStatus: result.rows[0].status,
    });
};

module.exports = { listIngredients, createIngredient, updateIngredient, deleteIngredient };
