'use strict';

const db = require('../config/db');

const sanitizeUser = (row, roles = []) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    equippedTitle: row.equipped_title || null,
    roles,
    primaryRole: roles[0] || 'USER',
});

const getUserRoles = async (userId) => {
    const roleResult = await db.query(
        `SELECT r.role_name
         FROM user_role ur
         JOIN role r ON ur.role_id = r.role_id
         WHERE ur.user_id = $1
         ORDER BY r.role_name`,
        [userId]
    );

    return roleResult.rows.map((r) => String(r.role_name || '').toUpperCase()).filter(Boolean);
};

const ensureUserRoleAssigned = async (userId, roleName) => {
    const normalizedRole = String(roleName).toUpperCase();
    let roleId;
    const roleRes = await db.query(
        "SELECT role_id FROM role WHERE UPPER(role_name) = $1 LIMIT 1",
        [normalizedRole]
    );
    if (roleRes.rows.length > 0) {
        roleId = roleRes.rows[0].role_id;
    } else {
        const newRoleRes = await db.query(
            "INSERT INTO role (role_name) VALUES ($1) RETURNING role_id",
            [normalizedRole]
        );
        roleId = newRoleRes.rows[0].role_id;
    }
    await db.query(
        "INSERT INTO user_role (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, roleId]
    );
};

module.exports = {
    sanitizeUser,
    getUserRoles,
    ensureUserRoleAssigned,
};
