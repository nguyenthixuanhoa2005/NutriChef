'use strict';

const db = require('../config/db');

const INGREDIENT_STATUS_ACTIVE = 'ACTIVE';
const INGREDIENT_STATUS_HIDDEN = 'HIDDEN';

let ingredientSoftDeleteReady = false;
let recipeSubmissionTableReady = false;
let achievementTablesReady = false;

const ensureIngredientSoftDeleteReady = async () => {
    if (ingredientSoftDeleteReady) {
        return;
    }

    await db.query(
        `ALTER TABLE ingredient
         ADD COLUMN IF NOT EXISTS status VARCHAR(20)
         CHECK (status IN ('ACTIVE', 'HIDDEN'))
         DEFAULT 'ACTIVE'`
    );

    await db.query(
        `UPDATE ingredient
         SET status = $1
         WHERE status IS NULL`,
        [INGREDIENT_STATUS_ACTIVE]
    );

    ingredientSoftDeleteReady = true;
};

const ensureRecipeSubmissionTableReady = async () => {
    if (recipeSubmissionTableReady) {
        return;
    }

    await db.query(
        `CREATE TABLE IF NOT EXISTS recipe_submission (
            submission_id SERIAL PRIMARY KEY,
            submitter_id INT NOT NULL REFERENCES app_user(user_id),
            title VARCHAR(150) NOT NULL,
            description TEXT,
            ingredients_json JSONB NOT NULL,
            steps_json JSONB NOT NULL,
            dish_type VARCHAR(100),
            image_url VARCHAR(500),
            temp_image_path VARCHAR(500),
            total_calories NUMERIC(6,2),
            cooking_time INT,
            difficulty VARCHAR(20),
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            reject_reason TEXT,
            reviewed_by INT REFERENCES app_user(user_id),
            reviewed_at TIMESTAMP,
            linked_recipe_id INT REFERENCES recipe(recipe_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await db.query(
        `ALTER TABLE recipe_submission
         ADD COLUMN IF NOT EXISTS temp_image_path VARCHAR(500)`
    );

    recipeSubmissionTableReady = true;
};

const ensureAchievementTablesReady = async () => {
    if (achievementTablesReady) return;

    await db.query(`ALTER TABLE app_user ADD COLUMN IF NOT EXISTS equipped_title VARCHAR(100)`);

    await db.query(`
        CREATE TABLE IF NOT EXISTS achievement (
            achievement_id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            criteria_type VARCHAR(50) NOT NULL,
            criteria_value INT NOT NULL,
            title_reward VARCHAR(100),
            icon_url VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS user_achievement (
            user_id INT REFERENCES app_user(user_id) ON DELETE CASCADE,
            achievement_id INT REFERENCES achievement(achievement_id) ON DELETE CASCADE,
            progress INT DEFAULT 0,
            is_completed BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id)
        )
    `);

    // Seed achievements if empty
    const countRes = await db.query('SELECT COUNT(*) FROM achievement');
    if (parseInt(countRes.rows[0].count) === 0) {
        await db.query(`
            INSERT INTO achievement (name, description, criteria_type, criteria_value, title_reward) VALUES
            ('Người mới vào bếp', 'Đăng tải 1 công thức được duyệt', 'RECIPE_COUNT', 1, 'Tập sự đầu bếp'),
            ('Đầu bếp nghiệp dư', 'Đăng tải 5 công thức được duyệt', 'RECIPE_COUNT', 5, 'Đầu bếp nghiệp dư'),
            ('Vua đầu bếp', 'Đăng tải 20 công thức được duyệt', 'RECIPE_COUNT', 20, 'Vua đầu bếp'),
            ('Người đánh giá tận tâm', 'Gửi 5 đánh giá cho các công thức', 'REVIEW_COUNT', 5, 'Chuyên gia phê bình'),
            ('Kẻ sành ăn', 'Lưu 10 công thức vào mục yêu thích', 'FAVORITE_COUNT', 10, 'Kẻ sành ăn'),
            ('Chuyên gia lên thực đơn', 'Lưu 5 mâm cơm yêu thích', 'MEAL_SET_COUNT', 5, 'Kiến trúc sư món ăn')
        `);
    }

    achievementTablesReady = true;
};

module.exports = {
    INGREDIENT_STATUS_ACTIVE,
    INGREDIENT_STATUS_HIDDEN,
    ensureIngredientSoftDeleteReady,
    ensureRecipeSubmissionTableReady,
    ensureAchievementTablesReady,
};
