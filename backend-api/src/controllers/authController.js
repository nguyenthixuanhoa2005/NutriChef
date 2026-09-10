'use strict';

const bcrypt = require('bcryptjs');
const axios = require('axios');
const db = require('../config/db');
const AppError = require('../errors/AppError');
const { issueTokenPair, verifyPassword } = require('../middlewares/auth');
const { sanitizeUser, getUserRoles, ensureUserRoleAssigned } = require('../services/authService');
const { LOGIN_EMAIL_REGEX, LOGIN_PASSWORD_POLICY_REGEX, requireBodyField } = require('../utils/recipeUtils');

// POST /api/auth/register
const register = async (req, res) => {
    const { email, password, fullName } = req.body || {};

    if (!email || !password || !fullName) {
        throw new AppError('Vui lòng điền đủ Họ tên, Email và Mật khẩu', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const plainPassword = String(password);

    if (!LOGIN_EMAIL_REGEX.test(normalizedEmail)) {
        throw new AppError('Email không hợp lệ', 400);
    }

    if (!LOGIN_PASSWORD_POLICY_REGEX.test(plainPassword)) {
        throw new AppError('Mật khẩu phải có ít nhất 6 ký tự, gồm 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt', 400);
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN'); // 1. Bắt đầu Transaction

        // 2. Kiểm tra email tồn tại
        const existing = await client.query('SELECT user_id FROM app_user WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        if (existing.rows.length > 0) {
            throw new AppError('Email đã được sử dụng', 400);
        }

        // 3. Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // 4. Tạo User và lấy ID thực tế vừa được sinh ra
        const userResult = await client.query(
            `INSERT INTO app_user (email, password_hash, full_name, status)
             VALUES ($1, $2, $3, 'ACTIVE')
             RETURNING user_id`,
            [normalizedEmail, hashedPassword, fullName]
        );

        const newUserId = userResult.rows[0].user_id;

        // 5. Lấy Role ID cho 'USER'
        let roleId;
        const roleRes = await client.query("SELECT role_id FROM role WHERE UPPER(role_name) = 'USER' LIMIT 1");
        if (roleRes.rows.length > 0) {
            roleId = roleRes.rows[0].role_id;
        } else {
            const newRoleRes = await client.query("INSERT INTO role (role_name) VALUES ('USER') RETURNING role_id");
            roleId = newRoleRes.rows[0].role_id;
        }

        // 6. Gán Role dựa trên ID vừa lấy được
        await client.query(
            "INSERT INTO user_role (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [newUserId, roleId]
        );

        await client.query('COMMIT'); // 7. Lưu mọi thay đổi

        res.status(201).json({
            status: 'success',
            message: 'Đăng ký tài khoản thành công',
            user: {
                userId: newUserId,
                email: normalizedEmail,
                fullName: fullName
            }
        });
    } catch (error) {
        await client.query('ROLLBACK'); // 8. Nếu lỗi ở bất kỳ bước nào, xóa sạch các lệnh tạm thời

        if (error.code === '23505') {
            throw new AppError('Email này đã được đăng ký. Vui lòng dùng email khác.', 400);
        }
        console.error('❌ Lỗi đăng ký:', error);
        throw new AppError(error.message || 'Có lỗi xảy ra khi đăng ký tài khoản', 500);
    } finally {
        client.release();
    }
};

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        requireBodyField(email, 'Email và mật khẩu là bắt buộc');
        requireBodyField(password, 'Email và mật khẩu là bắt buộc');

        const normalizedEmail = String(email).trim().toLowerCase();
        const plainPassword = String(password);

        if (!LOGIN_EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({
                status: 'error',
                message: 'Email không hợp lệ',
            });
        }

        if (!LOGIN_PASSWORD_POLICY_REGEX.test(plainPassword)) {
            return res.status(400).json({
                status: 'error',
                message: 'Mật khẩu phải có ít nhất 6 ký tự, gồm 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt',
            });
        }

        const userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [normalizedEmail]
        );

        const user = userResult.rows[0];
        if (!user || user.deleted_at || user.status !== 'ACTIVE') {
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản không tồn tại hoặc đã bị khóa',
            });
        }

        const passwordValid = await verifyPassword(plainPassword, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Sai email hoặc mật khẩu',
            });
        }

        const tokens = await issueTokenPair(user, req);

        const roles = await getUserRoles(user.user_id);
        return res.json({
            status: 'success',
            user: sanitizeUser(user, roles),
            ...tokens,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode || 400).json({
                status: 'error',
                message: error.message,
                ...(error.details ? { details: error.details } : {}),
            });
        }

        console.error('❌ Lỗi login:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi đăng nhập',
        });
    }
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
    try {
        const jwt = require('jsonwebtoken');
        const { REFRESH_TOKEN_SECRET } = require('../middlewares/auth');
        const { refreshToken } = req.body || {};
        if (!refreshToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu refresh token',
            });
        }

        let payload;
        try {
            payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token không hợp lệ hoặc đã hết hạn',
            });
        }

        if (payload.tokenType !== 'refresh' || !payload.sub) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token không hợp lệ',
            });
        }

        const tokenResult = await db.query(
            `SELECT token_id, user_id, is_revoked, expired_at
             FROM refresh_token
             WHERE token = $1
             LIMIT 1`,
            [refreshToken]
        );

        const tokenRow = tokenResult.rows[0];
        if (!tokenRow || tokenRow.is_revoked || new Date(tokenRow.expired_at) <= new Date()) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token đã bị thu hồi hoặc hết hạn',
            });
        }

        if (Number(tokenRow.user_id) !== Number(payload.sub)) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token không khớp người dùng',
            });
        }

        const userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE user_id = $1
             LIMIT 1`,
            [payload.sub]
        );

        const user = userResult.rows[0];
        if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản không hợp lệ',
            });
        }

        await db.query('UPDATE refresh_token SET is_revoked = true WHERE token_id = $1', [tokenRow.token_id]);

        const tokens = await issueTokenPair(user, req);
        const roles = await getUserRoles(user.user_id);
        return res.json({
            status: 'success',
            user: sanitizeUser(user, roles),
            ...tokens,
        });
    } catch (error) {
        console.error('❌ Lỗi refresh token:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi refresh token',
        });
    }
};

// POST /api/auth/logout
const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (refreshToken) {
            await db.query('UPDATE refresh_token SET is_revoked = true WHERE token = $1', [refreshToken]);
        }

        return res.json({
            status: 'success',
            message: 'Đăng xuất thành công',
        });
    } catch (error) {
        console.error('❌ Lỗi logout:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi đăng xuất',
        });
    }
};

// POST /api/auth/social/google
const socialGoogle = async (req, res) => {
    try {
        const { idToken, accessToken } = req.body || {};

        const verifyGoogleToken = async ({ googleIdToken, googleAccessToken }) => {
            const tokenInfoParams = googleIdToken
                ? { id_token: googleIdToken }
                : { access_token: googleAccessToken };

            const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
                params: tokenInfoParams,
                timeout: 8000,
            });

            const payload = response.data || {};
            const emailVerified = String(payload.email_verified).toLowerCase() === 'true';
            if (!payload.email || !emailVerified) {
                throw new Error('Google token hợp lệ nhưng email chưa xác thực');
            }

            return {
                email: payload.email,
                fullName: payload.name || null,
                avatarUrl: payload.picture || null,
            };
        };

        if (!idToken && !accessToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu token từ Google',
            });
        }

        let socialProfile;
        try {
            socialProfile = await verifyGoogleToken({
                googleIdToken: idToken,
                googleAccessToken: accessToken,
            });
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Google token không hợp lệ hoặc đã hết hạn',
            });
        }

        const normalizedEmail = String(socialProfile.email).trim().toLowerCase();
        const provider = 'google';
        const userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [normalizedEmail]
        );

        let user = userResult.rows[0];
        if (!user) {
            return res.status(404).json({
                status: 'error',
                code: 'SOCIAL_ACCOUNT_NOT_REGISTERED',
                message: 'Tài khoản chưa tồn tại. Vui lòng đăng ký tài khoản',
            });
        }

        await db.query(
            `UPDATE app_user
             SET full_name = COALESCE($2, full_name),
                 avatar_url = COALESCE($3, avatar_url)
             WHERE user_id = $1`,
            [user.user_id, socialProfile.fullName, socialProfile.avatarUrl]
        );

        const refreshed = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE user_id = $1
             LIMIT 1`,
            [user.user_id]
        );
        user = refreshed.rows[0];

        await ensureUserRoleAssigned(user.user_id, 'USER');

        if (user.status !== 'ACTIVE' || user.deleted_at) {
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản đã bị khóa',
            });
        }

        const tokens = await issueTokenPair(user, req);
        const roles = await getUserRoles(user.user_id);
        return res.json({
            status: 'success',
            provider,
            user: sanitizeUser(user, roles),
            ...tokens,
        });
    } catch (error) {
        console.error('❌ Lỗi social login google:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi đăng nhập google',
        });
    }
};

// GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const roles = await getUserRoles(req.authUser.user_id);

        // Lấy thông tin gói Premium hiện tại (nếu có)
        const premiumResult = await db.query(
            `SELECT uph.end_date, pp.plan_name
             FROM user_premium_history uph
             JOIN premium_plan pp ON uph.plan_id = pp.plan_id
             WHERE uph.user_id = $1 AND uph.end_date > NOW()
             ORDER BY uph.end_date DESC LIMIT 1`,
            [req.authUser.user_id]
        );

        const user = sanitizeUser(req.authUser, roles);
        if (premiumResult.rows.length > 0) {
            user.premium = {
                planName: premiumResult.rows[0].plan_name,
                expiryDate: premiumResult.rows[0].end_date
            };
        }

        return res.json({
            status: 'success',
            user: user,
        });
    } catch (error) {
        console.error('❌ Lỗi lấy thông tin phiên:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi lấy thông tin tài khoản',
        });
    }
};

module.exports = { register, login, refresh, logout, socialGoogle, getMe };
