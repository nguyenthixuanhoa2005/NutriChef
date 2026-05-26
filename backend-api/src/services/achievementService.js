
const db = require('../config/db');

/**
 * Lấy danh sách thành tựu và tiến độ của người dùng
 */
const getUserAchievements = async (userId) => {
    try {
        console.log(`[AchievementService] Fetching achievements for user ${userId}...`);
        const query = `
            SELECT 
                a.achievement_id,
                a.name,
                a.description,
                a.criteria_type,
                a.criteria_value,
                a.title_reward,
                a.icon_url,
                COALESCE(ua.progress, 0) as progress,
                COALESCE(ua.is_completed, false) as is_completed,
                ua.completed_at
            FROM achievement a
            LEFT JOIN user_achievement ua ON a.achievement_id = ua.achievement_id AND ua.user_id = $1
            ORDER BY a.achievement_id ASC
        `;
        const result = await db.query(query, [userId]);
        console.log(`[AchievementService] Found ${result.rows.length} achievements.`);
        return result.rows;
    } catch (error) {
        console.error('❌ Lỗi getUserAchievements:', error.message);
        // Trả về mảng rỗng thay vì crash nếu bảng chưa sẵn sàng
        if (error.message.includes('relation "achievement" does not exist')) {
            console.warn('[AchievementService] Table "achievement" does not exist yet.');
            return [];
        }
        throw error;
    }
};

/**
 * Cập nhật tiến độ thành tựu cho người dùng
 * @param {number} userId 
 * @param {string} criteriaType RECIPE_COUNT, REVIEW_COUNT, FAVORITE_COUNT, MEAL_SET_COUNT
 */
const updateAchievementProgress = async (userId, criteriaType) => {
    // 1. Lấy tất cả các thành tựu thuộc loại criteriaType
    const achievements = await db.query(
        'SELECT achievement_id, criteria_value, title_reward FROM achievement WHERE criteria_type = $1',
        [criteriaType]
    );

    if (achievements.rows.length === 0) return;

    // 2. Đếm số lượng thực tế từ các bảng liên quan
    let actualCount = 0;
    switch (criteriaType) {
        case 'RECIPE_COUNT':
            const recipeRes = await db.query('SELECT COUNT(*)::int as count FROM recipe WHERE author_id = $1 AND status = \'APPROVED\'', [userId]);
            actualCount = recipeRes.rows[0].count;
            break;
        case 'REVIEW_COUNT':
            const reviewRes = await db.query('SELECT COUNT(*)::int as count FROM rating WHERE user_id = $1', [userId]);
            actualCount = reviewRes.rows[0].count;
            break;
        case 'FAVORITE_COUNT':
            const favoriteRes = await db.query('SELECT COUNT(*)::int as count FROM favorite_recipe WHERE user_id = $1', [userId]);
            actualCount = favoriteRes.rows[0].count;
            break;
        case 'MEAL_SET_COUNT':
            const mealSetRes = await db.query('SELECT COUNT(*)::int as count FROM favorite_meal_set WHERE user_id = $1', [userId]);
            actualCount = mealSetRes.rows[0].count;
            break;
    }

    // 3. Cập nhật bảng user_achievement cho từng thành tựu
    for (const achievement of achievements.rows) {
        const isCompleted = actualCount >= achievement.criteria_value;
        
        await db.query(
            `INSERT INTO user_achievement (user_id, achievement_id, progress, is_completed, completed_at)
             VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END)
             ON CONFLICT (user_id, achievement_id) 
             DO UPDATE SET 
                progress = EXCLUDED.progress,
                is_completed = EXCLUDED.is_completed,
                completed_at = CASE 
                    WHEN EXCLUDED.is_completed AND NOT user_achievement.is_completed THEN CURRENT_TIMESTAMP 
                    ELSE user_achievement.completed_at 
                END`,
            [userId, achievement.achievement_id, actualCount, isCompleted]
        );
    }
};

/**
 * Đặt danh hiệu cho người dùng
 */
const equipTitle = async (userId, title) => {
    // Kiểm tra xem user đã hoàn thành thành tựu nào có danh hiệu này chưa
    const check = await db.query(
        `SELECT 1 FROM user_achievement ua
         JOIN achievement a ON ua.achievement_id = a.achievement_id
         WHERE ua.user_id = $1 AND a.title_reward = $2 AND ua.is_completed = true
         LIMIT 1`,
        [userId, title]
    );

    if (check.rows.length === 0 && title !== null) {
        throw new Error('Bạn chưa mở khóa danh hiệu này');
    }

    await db.query(
        'UPDATE app_user SET equipped_title = $1 WHERE user_id = $2',
        [title, userId]
    );
};

module.exports = {
    getUserAchievements,
    updateAchievementProgress,
    equipTitle
};
