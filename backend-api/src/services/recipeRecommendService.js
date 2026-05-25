// src/services/recipeRecommendService.js 
// Đây là service gợi ý món ăn dựa trên danh sách ID nguyên liệu
// Đã cập nhật logic để đảm bảo tính chính xác bằng cách kiểm tra bảng recipe_ingredient_map

const RECIPE_RECOMMEND_QUERY = `
    SELECT
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
        r.status,
        -- Đếm số lượng nguyên liệu khớp để sắp xếp độ ưu tiên
        COUNT(DISTINCT rim.ingredient_id) AS match_count,
        ARRAY_AGG(DISTINCT i.name) FILTER (WHERE i.ingredient_id = ANY($1::int[])) AS matched_ingredient_names
    FROM recipe r
    INNER JOIN recipe_ingredient_map rim ON r.recipe_id = rim.recipe_id
    INNER JOIN ingredient i ON i.ingredient_id = rim.ingredient_id
    -- Chỉ lấy các món đã được duyệt và có ít nhất 1 nguyên liệu khớp trong danh sách tìm kiếm
    WHERE rim.ingredient_id = ANY($1::int[])
      AND r.status = 'APPROVED'
    GROUP BY
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
        r.status
    -- Ưu tiên món có nhiều nguyên liệu khớp nhất, sau đó đến món mới nhất
    ORDER BY match_count DESC, r.recipe_id DESC
    LIMIT 20
`;

const normalizeIngredientIds = (ingredientIds) => {
    if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) {
        return null;
    }

    const normalized = ingredientIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (normalized.length === 0) {
        return null;
    }

    return [...new Set(normalized)];
};

const recommendRecipesByIngredientIds = async (dbClient, ingredientIds) => {
    const normalizedIngredientIds = normalizeIngredientIds(ingredientIds);

    if (!normalizedIngredientIds) {
        const error = new Error('Danh sách nguyên liệu không hợp lệ');
        error.statusCode = 400;
        throw error;
    }

    const result = await dbClient.query(RECIPE_RECOMMEND_QUERY, [normalizedIngredientIds]);
    return result.rows;
};

module.exports = {
    RECIPE_RECOMMEND_QUERY,
    normalizeIngredientIds,
    recommendRecipesByIngredientIds,
};
