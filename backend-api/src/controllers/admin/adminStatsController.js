'use strict';

const db = require('../../config/db');
const { ensureAdminRole } = require('../../middlewares/auth');

// GET /api/admin/stats
const getStats = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const userCount = await db.query("SELECT COUNT(*) FROM app_user WHERE status != 'DELETED'");
    const recipeCount = await db.query("SELECT COUNT(*) FROM recipe WHERE status != 'HIDDEN'");
    const pendingCount = await db.query("SELECT COUNT(*) FROM recipe_submission WHERE status = 'PENDING'");
    const ingredientCount = await db.query("SELECT COUNT(*) FROM ingredient WHERE status = 'ACTIVE'");

    const recentRecipes = await db.query(`
        SELECT r.title, r.created_at, COALESCE(u.full_name, 'NutriChef') as author_name
        FROM recipe r
        LEFT JOIN app_user u ON u.user_id = r.author_id
        WHERE r.status != 'HIDDEN'
        ORDER BY r.created_at DESC
        LIMIT 5
    `);

    res.json({
        status: 'success',
        stats: {
            totalUsers: parseInt(userCount.rows[0].count),
            totalRecipes: parseInt(recipeCount.rows[0].count),
            pendingSubmissions: parseInt(pendingCount.rows[0].count),
            totalIngredients: parseInt(ingredientCount.rows[0].count)
        },
        recentActivities: recentRecipes.rows
    });
};

module.exports = { getStats };
