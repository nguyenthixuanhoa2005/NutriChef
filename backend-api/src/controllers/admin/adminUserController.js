'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const AppError = require('../../errors/AppError');
const { ensureAdminRole } = require('../../middlewares/auth');

// GET /api/admin/users
const listUsers = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) return;

    const result = await db.query(
        `SELECT
            u.user_id as id,
            u.email,
            u.full_name,
            u.avatar_url as avatar,
            u.status,
            u.create_at as created_at,
            string_agg(r.role_name, ',') as roles
         FROM app_user u
         LEFT JOIN user_role ur ON u.user_id = ur.user_id
         LEFT JOIN role r ON ur.role_id = r.role_id
         WHERE u.status != 'DELETED'
         GROUP BY u.user_id
         ORDER BY u.create_at DESC`
    );

    const users = result.rows.map(u => ({
        ...u,
        roles: u.roles ? u.roles.split(',') : [],
        role: u.roles && u.roles.includes('ADMIN') ? 'admin' : 'user'
    }));

    res.json(users);
};

// GET /api/admin/users/:id/recipes
const getUserRecipes = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) return;

    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new AppError('ID người dùng không hợp lệ', 400);
    }

    const userResult = await db.query(
        `SELECT user_id, full_name, email, status, create_at
         FROM app_user
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
    );

    if (userResult.rows.length === 0) {
        throw new AppError('Người dùng không tồn tại', 404);
    }

    const recipesResult = await db.query(
        `SELECT
            r.recipe_id::text AS item_id,
            r.title,
            COALESCE(r.status, 'APPROVED') AS status,
            r.created_at,
            'recipe' AS source
         FROM recipe r
         WHERE r.author_id = $1
           AND COALESCE(r.status, 'APPROVED') != 'HIDDEN'

         UNION ALL

         SELECT
            rs.submission_id::text AS item_id,
            rs.title,
            COALESCE(rs.status, 'PENDING') AS status,
            rs.created_at,
            'submission' AS source
         FROM recipe_submission rs
         WHERE rs.submitter_id = $1

         ORDER BY created_at DESC`,
        [userId]
    );

    res.json({
        status: 'success',
        user: userResult.rows[0],
        recipes: recipesResult.rows,
    });
};

// POST /api/admin/users
const createUser = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) return;

    // Log để debug
    console.log('📦 Nhận request POST /api/admin/users');
    console.log('Headers:', req.headers['content-type']);
    console.log('Body:', req.body);

    if (!req.body || Object.keys(req.body).length === 0) {
        throw new AppError('Dữ liệu gửi lên trống (req.body undefined)', 400);
    }

    const body = req.body || {};
    const { email, password, full_name, role } = body;
    if (!email || !password || !full_name) {
        throw new AppError('Vui lòng điền đủ Họ tên, Email và Mật khẩu', 400);
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT user_id FROM app_user WHERE email = $1', [email]);
        if (existing.rows.length > 0) throw new AppError('Email đã được sử dụng', 400);

        const hashedPassword = await bcrypt.hash(password, 10);
        const userResult = await client.query(
            `INSERT INTO app_user (email, password_hash, full_name, status)
             VALUES ($1, $2, $3, 'ACTIVE')
             RETURNING user_id, email, full_name, create_at`,
            [email, hashedPassword, full_name]
        );

        const userId = userResult.rows[0].user_id;
        const targetRole = String(role || 'USER').toUpperCase();

        let roleIdResult = await client.query('SELECT role_id FROM role WHERE role_name = $1', [targetRole]);
        if (roleIdResult.rows.length === 0) {
            roleIdResult = await client.query('INSERT INTO role (role_name) VALUES ($1) RETURNING role_id', [targetRole]);
        }
        const roleId = roleIdResult.rows[0].role_id;
        await client.query('INSERT INTO user_role (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);

        await client.query('COMMIT');
        res.status(201).json({ status: 'success', user: { ...userResult.rows[0], role: role.toLowerCase() } });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// PUT /api/admin/users/:id
const updateUser = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) return;

    const userId = Number(req.params.id);
    if (!req.body || Object.keys(req.body).length === 0) {
        throw new AppError('Dữ liệu cập nhật trống', 400);
    }
    const body = req.body || {};
    const { email, full_name, role, password } = body;

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        let query = 'UPDATE app_user SET email = $1, full_name = $2';
        let params = [email, full_name, userId];

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password_hash = $4 WHERE user_id = $3';
            params.push(hashedPassword);
        } else {
            query += ' WHERE user_id = $3';
        }

        const result = await client.query(query, params);
        if (result.rowCount === 0) throw new AppError('Người dùng không tồn tại', 404);

        if (role) {
            const targetRole = String(role).toUpperCase();
            let roleIdResult = await client.query('SELECT role_id FROM role WHERE role_name = $1', [targetRole]);
            if (roleIdResult.rows.length > 0) {
                const roleId = roleIdResult.rows[0].role_id;
                await client.query('DELETE FROM user_role WHERE user_id = $1', [userId]);
                await client.query('INSERT INTO user_role (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
            }
        }
        await client.query('COMMIT');
        res.json({ status: 'success', message: 'Cập nhật thành công' });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
    if (!(await ensureAdminRole(req, res))) return;

    const userId = Number(req.params.id);
    const authUserId = Number(req.authUser?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new AppError('ID người dùng không hợp lệ', 400);
    }

    // Ngăn admin tự xóa mình
    if (Number.isInteger(authUserId) && userId === authUserId) {
        throw new AppError('Bạn không thể tự xóa tài khoản của mình', 400);
    }

    const result = await db.query(
        "UPDATE app_user SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP WHERE user_id = $1",
        [userId]
    );

    if (result.rowCount === 0) throw new AppError('Người dùng không tồn tại', 404);

    res.json({ status: 'success', message: 'Đã xóa người dùng' });
};

module.exports = { listUsers, getUserRecipes, createUser, updateUser, deleteUser };
