const AppError = require('../errors/AppError');

const VALID_INGREDIENT_TYPES = ['MEAT', 'VEGETABLE', 'SPICE', 'FRUIT', 'STARCH', 'OTHER'];
const INGREDIENT_STATUS_ACTIVE = 'ACTIVE';

const ADD_INGREDIENT_QUERY = `INSERT INTO ingredient (name, type, image_url, is_common, keywords, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ingredient_id, name, type, image_url, is_common, keywords, status`;

/**
 * Thêm nguyên liệu mới vào DB.
 * @param {object} db - đối tượng db có phương thức query()
 * @param {object} fields - { name, type, image_url, is_common, keywords }
 * @returns {Promise<object>} - hàng nguyên liệu vừa được tạo
 */
async function addIngredient(db, { name, type, image_url, is_common, keywords } = {}) {
    if (!name || !type) throw new AppError('Ten va loai nguyen lieu la bat buoc', 400);
    if (!VALID_INGREDIENT_TYPES.includes(type)) throw new AppError('Loai nguyen lieu khong hop le', 400);

    const normalizedName = String(name).trim();
    
    // Kiểm tra trùng tên (không phân biệt hoa thường, chỉ xét các nguyên liệu đang ACTIVE)
    const existing = await db.query(
        'SELECT ingredient_id FROM ingredient WHERE LOWER(name) = LOWER($1) AND status = $2 LIMIT 1',
        [normalizedName, INGREDIENT_STATUS_ACTIVE]
    );

    if (existing.rows.length > 0) {
        throw new AppError(`Nguyen lieu "${normalizedName}" da ton tai trong he thong`, 400);
    }

    const result = await db.query(ADD_INGREDIENT_QUERY, [
        normalizedName,
        type,
        image_url || null,
        Boolean(is_common),
        keywords ? String(keywords).trim() : null,
        INGREDIENT_STATUS_ACTIVE,
    ]);
    return result.rows[0];
}

module.exports = { addIngredient, VALID_INGREDIENT_TYPES, ADD_INGREDIENT_QUERY, INGREDIENT_STATUS_ACTIVE };
