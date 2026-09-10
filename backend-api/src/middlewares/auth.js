'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const ACCESS_TOKEN_SECRET = String(process.env.JWT_ACCESS_SECRET || '').trim();
const REFRESH_TOKEN_SECRET = String(process.env.JWT_REFRESH_SECRET || '').trim();
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const toMs = (expiresIn) => {
    const value = String(expiresIn).trim();
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
        return 30 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const factors = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return amount * factors[unit];
};

const refreshTokenExpiresMs = toMs(REFRESH_TOKEN_EXPIRES_IN);

// --- TOKEN HELPERS ---
const getBearerToken = (req) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice('Bearer '.length).trim() || null;
};

const buildTokenPayload = (user) => ({
    sub: user.user_id,
    email: user.email,
    fullName: user.full_name,
});

const issueAccessToken = (user) => jwt.sign(buildTokenPayload(user), ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
});

const issueRefreshToken = (user) => jwt.sign(
    {
        sub: user.user_id,
        tokenType: 'refresh',
    },
    REFRESH_TOKEN_SECRET,
    {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    }
);

const saveRefreshToken = async (userId, refreshToken, req) => {
    const expiredAt = new Date(Date.now() + refreshTokenExpiresMs);
    const deviceInfo = String(req.headers['user-agent'] || 'unknown').slice(0, 100);
    const ipAddress = String(req.ip || req.connection?.remoteAddress || 'unknown').slice(0, 50);

    await db.query(
        `INSERT INTO refresh_token (user_id, token, expired_at, device_info, ip_address, is_revoked)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [userId, refreshToken, expiredAt, deviceInfo, ipAddress]
    );
};

const issueTokenPair = async (user, req) => {
    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);
    await saveRefreshToken(user.user_id, refreshToken, req);

    return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    };
};

const verifyPassword = async (plainPassword, storedPasswordHash) => {
    if (!storedPasswordHash) {
        return false;
    }

    // Hỗ trợ dữ liệu cũ đang lưu plain-text trong file seed.
    if (storedPasswordHash.startsWith('$2a$') || storedPasswordHash.startsWith('$2b$')) {
        return bcrypt.compare(plainPassword, storedPasswordHash);
    }

    return plainPassword === storedPasswordHash;
};

// --- MIDDLEWARES ---
const authenticateAccessToken = async (req, res, next) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Thiếu access token',
            });
        }

        let payload;
        try {
            payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Access token không hợp lệ hoặc đã hết hạn',
            });
        }

        const userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, equipped_title, deleted_at
             FROM app_user
             WHERE user_id = $1
             LIMIT 1`,
            [payload.sub]
        );

        const user = userResult.rows[0];
        if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
            return res.status(401).json({
                status: 'error',
                message: 'Phiên đăng nhập không còn hợp lệ',
            });
        }

        req.authUser = user;
        next();
    } catch (error) {
        console.error('❌ Lỗi authenticateAccessToken:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi xác thực phiên',
        });
    }
};

/**
 * Helper kiểm tra quyền ADMIN. Trả về true nếu hợp lệ, false nếu đã gửi 403.
 * Dùng trong controllers: if (!(await ensureAdminRole(req, res))) return;
 */
const ensureAdminRole = async (req, res) => {
    const { getUserRoles } = require('../services/authService');
    const roles = await getUserRoles(req.authUser.user_id);
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin) {
        res.status(403).json({
            status: 'error',
            message: 'Bạn không có quyền thực hiện thao tác này',
        });
        return false;
    }

    return true;
};

module.exports = {
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    getBearerToken,
    buildTokenPayload,
    issueAccessToken,
    issueRefreshToken,
    saveRefreshToken,
    issueTokenPair,
    verifyPassword,
    authenticateAccessToken,
    ensureAdminRole,
};
