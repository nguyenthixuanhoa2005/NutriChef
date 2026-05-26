const express = require('express');
require('dotenv').config();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./src/config/db');   //kết nối db qua file riêng
const AppError = require('./src/errors/AppError');
const asyncHandler = require('./src/errors/asyncHandler');
const errorHandler = require('./src/errors/errorHandler');
const {
    recommendRecipesByIngredientIds,
} = require('./src/services/recipeRecommendService');
const {
    createRecipeRecommendHandler,
} = require('./src/controllers/recipeRecommendController');
const {
    getCloudinaryConfigSummary,
    uploadImageFromPath,
} = require('./src/services/cloudinaryService');
const {
    addIngredient,
} = require('./src/services/adminIngredientService');
const {
    getUserAchievements,
    updateAchievementProgress,
    equipTitle,
} = require('./src/services/achievementService');

const app = express();
const port = Number(process.env.PORT || 3000);
const AI_SERVICE_BASE_URL = String(process.env.AI_SERVICE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 30000);

const ACCESS_TOKEN_SECRET = String(process.env.JWT_ACCESS_SECRET || '').trim();
const REFRESH_TOKEN_SECRET = String(process.env.JWT_REFRESH_SECRET || '').trim();
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const INGREDIENT_STATUS_ACTIVE = 'ACTIVE';
const INGREDIENT_STATUS_HIDDEN = 'HIDDEN';
let ingredientSoftDeleteReady = false;
let recipeSubmissionTableReady = false;
let achievementTablesReady = false;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error('Thiếu JWT_ACCESS_SECRET hoặc JWT_REFRESH_SECRET trong .env');
}

// --- UTILS & MIDDLEWARES (MOVED UP TO FIX REFERENCE ERROR) ---
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

const getBearerToken = (req) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice('Bearer '.length).trim() || null;
};

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

// --- END UTILS & MIDDLEWARES ---

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept'],
    credentials: true
}));

// --- DEBUG ROUTE ---
app.get('/api/ping', (req, res) => res.json({ status: 'ok', message: 'Pong! Server is updated.' }));

// --- ACHIEVEMENT API (MOVED UP) ---
app.get('/api/achievements', authenticateAccessToken, asyncHandler(async (req, res) => {
    try {
        console.log(`[API] GET /api/achievements - User: ${req.authUser?.user_id}`);
        const achievements = await getUserAchievements(req.authUser.user_id);
        return res.status(200).json({ status: 'success', achievements: achievements || [] });
    } catch (error) {
        console.error('❌ Lỗi API achievements:', error.message);
        return res.status(500).json({ status: 'error', message: error.message });
    }
}));

app.post('/api/achievements/equip-title', authenticateAccessToken, asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    await equipTitle(req.authUser.user_id, title || null);
    res.json({ status: 'success', message: 'Cập nhật danh hiệu thành công' });
}));

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

const ensureAdminRole = async (req, res) => {
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

const LOGIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const requireBodyField = (value, message) => {
    if (!value) {
        throw new AppError(message, 400);
    }
};

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const capitalizeWords = (value) => String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
        const lower = word.toLocaleLowerCase('vi-VN');
        return lower.charAt(0).toLocaleUpperCase('vi-VN') + lower.slice(1);
    })
    .join(' ');

const ALLOWED_DISH_TYPES = new Set(['MAIN_DISH', 'SIDE_DISH', 'DESSERT']);
const ALLOWED_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);

const normalizeDishType = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) {
        return null;
    }

    if (ALLOWED_DISH_TYPES.has(normalized)) {
        return normalized;
    }

    // Backward compatibility for old clients that still submit legacy types.
    if (normalized === 'DRINK' || normalized === 'SNACK' || normalized === 'BREAKFAST') {
        return 'DESSERT';
    }

    return null;
};

const normalizeDifficulty = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) {
        return null;
    }

    return ALLOWED_DIFFICULTIES.has(normalized) ? normalized : null;
};

const parsePositiveNumber = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        return null;
    }
    return num;
};

const parsePositiveInteger = (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
        return null;
    }
    return num;
};

const parseJsonArrayInput = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    return [];
};

const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (_) {}
};

const normalizeIngredientsJson = (ingredients) => {
    if (!Array.isArray(ingredients)) {
        return [];
    }

    return ingredients
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const normalizedName = capitalizeWords(item.name || item.ingredient_name || '');
            if (!normalizedName) {
                return null;
            }

            const next = {
                ...item,
                name: normalizedName,
            };

            return next;
        })
        .filter(Boolean);
};

const normalizeIngredientLookupKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const enrichIngredientsWithIds = async (client, ingredients) => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
        return [];
    }

    const namesToResolve = [...new Set(
        ingredients
            .filter((item) => {
                const existingId = Number(item?.id || item?.ingredient_id);
                return !Number.isInteger(existingId) || existingId <= 0;
            })
            .map((item) => normalizeIngredientLookupKey(item?.name || item?.ingredient_name || ''))
            .filter(Boolean)
    )];

    const nameToId = new Map();
    if (namesToResolve.length > 0) {
        const matchedIngredients = await client.query(
            `SELECT ingredient_id, name
             FROM ingredient
             WHERE LOWER(TRIM(name)) = ANY($1::text[])`,
            [namesToResolve]
        );

        matchedIngredients.rows.forEach((row) => {
            const key = normalizeIngredientLookupKey(row.name);
            const id = Number(row.ingredient_id);
            if (key && Number.isInteger(id) && id > 0 && !nameToId.has(key)) {
                nameToId.set(key, id);
            }
        });
    }

    return ingredients.map((item) => {
        const existingId = Number(item?.id || item?.ingredient_id);
        const key = normalizeIngredientLookupKey(item?.name || item?.ingredient_name || '');
        const resolvedId = Number.isInteger(existingId) && existingId > 0
            ? existingId
            : (nameToId.get(key) || null);

        if (!resolvedId) {
            return item;
        }

        return {
            ...item,
            id: resolvedId,
            ingredient_id: resolvedId,
        };
    });
};

const normalizeStepsJson = (steps) => {
    if (!Array.isArray(steps)) {
        return [];
    }

    return steps
        .map((item, index) => {
            if (typeof item === 'string') {
                const content = String(item).trim();
                return content ? { step: index + 1, content } : null;
            }

            if (!item || typeof item !== 'object') {
                return null;
            }

            const content = String(item.content || '').trim();
            if (!content) {
                return null;
            }

            return {
                ...item,
                step: Number(item.step) || index + 1,
                content,
            };
        })
        .filter(Boolean);
};

const expandAiKeywords = (keywords) => {
    const expanded = new Set();

    (keywords || []).forEach((keyword) => {
        const raw = String(keyword || '').trim();
        if (!raw) {
            return;
        }

        expanded.add(raw);
        const normalized = normalizeText(raw);

        // Chỉ thêm các họ nguyên liệu khi khớp chính xác từ khóa hoặc là từ đơn
        if (normalized === 'ca' || normalized === 'ca loc' || normalized === 'ca hoi') {
            expanded.add('Cá');
        }
        if (normalized === 'bo' || normalized === 'thit bo' || normalized === 'bo nac') {
            expanded.add('Thịt bò');
        }
        if (normalized === 'ga' || normalized === 'thit ga' || normalized === 'uc ga') {
            expanded.add('Thịt gà');
        }
    });

    return [...expanded];
};

// --- CẤU HÌNH UPLOAD ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// --- API 1: AI DETECT ---
app.post('/api/ai/detect-ingredients', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const type = req.query.type || 'image';

        if (!file) return res.status(400).json({ error: 'Vui lòng upload file' });

        // 1. Gọi sang Python Service
        const aiServiceUrl = type === 'voice'
            ? `${AI_SERVICE_BASE_URL}/detect/voice`
            : `${AI_SERVICE_BASE_URL}/detect/image`;

        const formData = new FormData();
        const originalName = String(file.originalname || '').trim()
            || (type === 'voice' ? 'recording.wav' : 'upload.jpg');
        const contentType = String(file.mimetype || '').trim()
            || (type === 'voice' ? 'audio/wav' : 'image/jpeg');

        formData.append('file', fs.createReadStream(file.path), {
            filename: originalName,
            contentType,
        });

        const aiResponse = await axios.post(aiServiceUrl, formData, {
            headers: { ...formData.getHeaders() },
            timeout: AI_SERVICE_TIMEOUT_MS,
        });

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        const aiKeywords = aiResponse.data.detected_ingredients || [];
        const keywordsForLookup = expandAiKeywords(aiKeywords);

        // 2. Tra cứu DB để tìm thông tin nguyên liệu chi tiết
        if (keywordsForLookup.length === 0) {
            return res.json({
                status: 'success',
                ai_text: aiResponse.data.raw_text || '',
                detected_ingredients: [],
                ingredients: [],
            });
        }

        await ensureIngredientSoftDeleteReady();

        // Truy vấn cực kỳ nghiêm ngặt: Chỉ lấy ID nếu tên khớp hoàn toàn
        const result = await db.query(
            `SELECT ingredient_id as id, name
             FROM ingredient
             WHERE status = $1
               AND LOWER(name) = ANY(SELECT LOWER(unnest($2::text[])))`,
            [INGREDIENT_STATUS_ACTIVE, keywordsForLookup]
        );

        // Loại bỏ trùng lặp nếu có
        const uniqueIngredients = result.rows.filter((value, index, self) =>
            index === self.findIndex((t) => t.id === value.id)
        );

        console.log(`🔍 AI Detect: Tìm thấy ${uniqueIngredients.length} nguyên liệu trong DB.`);

        res.json({
            status: 'success',
            ai_text: aiResponse.data.raw_text,
            detected_ingredients: aiKeywords,
            ingredients: uniqueIngredients 
        });

    } catch (error) {
        const aiStatus = Number(error?.response?.status);
        const aiData = error?.response?.data;
        const aiMessage = String(
            aiData?.error
            || aiData?.message
            || error?.message
            || 'Lỗi server khi gọi AI service'
        );

        console.error('❌ Lỗi API AI:', aiMessage);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        // 502 when upstream AI service failed/unreachable, keep 4xx if AI explicitly returned client error.
        const statusCode = Number.isInteger(aiStatus)
            ? (aiStatus >= 400 && aiStatus < 500 ? aiStatus : 502)
            : 502;

        res.status(statusCode).json({
            status: 'error',
            error: aiMessage,
            source: 'ai-service',
        });
    }
});

// --- API 2: RECIPE RECOMMEND (MỚI THÊM) ---
app.post('/api/recipes/recommend', createRecipeRecommendHandler(db, recommendRecipesByIngredientIds));

// --- API 3: INTERNAL - GET ALL INGREDIENTS FOR AI SERVICE ---
app.get('/api/internal/all-ingredients', async (req, res) => {
    try {
        console.log("🔄 Yêu cầu lấy danh sách nguyên liệu từ AI Service...");
        await ensureIngredientSoftDeleteReady();
        const result = await db.query(
            `SELECT name
             FROM ingredient
             WHERE status = $1`,
            [INGREDIENT_STATUS_ACTIVE]
        );
        const ingredientNames = result.rows.map(row => row.name);
        res.json(ingredientNames);
        console.log(`✅ Đã gửi ${ingredientNames.length} nguyên liệu cho AI Service.`);
    } catch (error) {
        console.error("❌ Lỗi API all-ingredients:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách nguyên liệu' });
    }
});

// --- API 4: PUBLIC - INGREDIENT CATALOG FOR MOBILE ---
app.get('/api/ingredients', async (req, res) => {
    try {
        await ensureIngredientSoftDeleteReady();
        const result = await db.query(
            `SELECT ingredient_id, name, type, image_url, is_common, keywords
             FROM ingredient
             WHERE status = $1
             ORDER BY is_common DESC, ingredient_id ASC`,
            [INGREDIENT_STATUS_ACTIVE]
        );

        res.json({
            status: 'success',
            ingredients: result.rows,
        });
    } catch (error) {
        console.error("❌ Lỗi API ingredients:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách nguyên liệu' });
    }
});

// --- API 5: PUBLIC - TRENDING RECIPES FOR HOME ---
app.get('/api/recipes/trending', async (req, res) => {
    try {
        const { dishType } = req.query;
        const parsedLimit = Number(req.query.limit || 20);
        const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 20;

        let query = `
            SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.dish_type,
                r.difficulty,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr.user_id) AS like_count
            FROM recipe r
            LEFT JOIN app_user u ON u.user_id = r.author_id
            LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
            LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
            WHERE r.status = 'APPROVED'
        `;

        const queryParams = [];
        if (dishType) {
            query += ` AND r.dish_type = $1`;
            queryParams.push(dishType.toUpperCase());
        }

        query += `
            GROUP BY r.recipe_id, u.full_name
            ORDER BY 
                (CASE WHEN r.created_at >= NOW() - INTERVAL '48 hours' THEN 1 ELSE 0 END) DESC,
                avg_rating DESC, 
                like_count DESC, 
                r.recipe_id DESC
            LIMIT $${queryParams.length + 1}
        `;
        queryParams.push(limit);

        const result = await db.query(query, queryParams);

        res.json({
            status: 'success',
            recipes: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API recipes/trending:', error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách công thức' });
    }
});

app.get('/api/recipes/favorites', authenticateAccessToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.difficulty,
                r.ingredients_json,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr2.user_id) AS like_count
             FROM favorite_recipe fr
             JOIN recipe r ON r.recipe_id = fr.recipe_id
             LEFT JOIN app_user u ON u.user_id = r.author_id
             LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
             LEFT JOIN favorite_recipe fr2 ON fr2.recipe_id = r.recipe_id
             WHERE fr.user_id = $1
             GROUP BY r.recipe_id, u.full_name
             ORDER BY r.recipe_id DESC`,
            [req.authUser.user_id]
        );

        return res.json({
            status: 'success',
            recipes: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API recipes/favorites:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn công thức yêu thích' });
    }
});

app.get('/api/recipes/:id', async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const result = await db.query(
            `SELECT
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
                r.created_at,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr.user_id) AS like_count
             FROM recipe r
             LEFT JOIN app_user u ON u.user_id = r.author_id
             LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
             LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
             WHERE r.recipe_id = $1
             GROUP BY r.recipe_id, u.full_name
             LIMIT 1`,
            [recipeId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        return res.json({
            status: 'success',
            recipe: result.rows[0],
        });
    } catch (error) {
        console.error('❌ Lỗi API recipe detail:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn chi tiết công thức' });
    }
});

// Lấy danh sách đánh giá của công thức
app.get('/api/recipes/:id/ratings', async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        const result = await db.query(
            `SELECT 
                r.rating_id,
                r.score,
                r.comment,
                r.created_at,
                u.full_name,
                u.avatar_url
             FROM rating r
             JOIN app_user u ON r.user_id = u.user_id
             WHERE r.recipe_id = $1
             ORDER BY r.created_at DESC`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            ratings: result.rows
        });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách đánh giá:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn danh sách đánh giá' });
    }
});

// Gửi hoặc cập nhật đánh giá
app.post('/api/recipes/:id/ratings', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        const userId = req.authUser.user_id;
        const { score, comment } = req.body;

        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ error: 'Điểm đánh giá phải từ 1 đến 5' });
        }

        // Kiểm tra xem đã đánh giá chưa
        const existingRating = await db.query(
            'SELECT rating_id FROM rating WHERE user_id = $1 AND recipe_id = $2',
            [userId, recipeId]
        );

        if (existingRating.rows.length > 0) {
            // Cập nhật
            await db.query(
                'UPDATE rating SET score = $1, comment = $2, created_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND recipe_id = $4',
                [score, comment, userId, recipeId]
            );
        } else {
            // Thêm mới
            await db.query(
                'INSERT INTO rating (user_id, recipe_id, score, comment) VALUES ($1, $2, $3, $4)',
                [userId, recipeId, score, comment]
            );
        }

        // Hook cập nhật thành tựu
        updateAchievementProgress(userId, 'REVIEW_COUNT').catch(console.error);

        // Lấy lại thông số trung bình để trả về cập nhật UI
        const stats = await db.query(
            `SELECT 
                COALESCE(ROUND(AVG(score)::numeric, 1), 0) AS avg_rating,
                COUNT(*) AS rating_count
             FROM rating 
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            message: 'Đánh giá thành công',
            avg_rating: stats.rows[0].avg_rating,
            rating_count: stats.rows[0].rating_count
        });
    } catch (error) {
        console.error('❌ Lỗi gửi đánh giá:', error.message);
        return res.status(500).json({ error: 'Lỗi hệ thống khi gửi đánh giá' });
    }
});

app.get('/api/recipes/:id/favorite-status', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const result = await db.query(
            `SELECT 1
             FROM favorite_recipe
             WHERE user_id = $1
               AND recipe_id = $2
             LIMIT 1`,
            [req.authUser.user_id, recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: result.rows.length > 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API favorite-status:', error.message);
        return res.status(500).json({ error: 'Lỗi kiểm tra trạng thái yêu thích' });
    }
});

app.post('/api/recipes/submissions', authenticateAccessToken, upload.single('image'), async (req, res) => {
    const uploadedTempImagePath = req.file?.path || null;
    try {
        await ensureRecipeSubmissionTableReady();

        const {
            title,
            description,
            ingredients_json,
            steps_json,
            dish_type,
            image_url,
            total_calories,
            cooking_time,
            difficulty,
        } = req.body || {};

        const normalizedTitle = capitalizeWords(title || '');
        if (!normalizedTitle) {
            return res.status(400).json({ status: 'error', message: 'Tiêu đề công thức là bắt buộc' });
        }

        const normalizedIngredients = normalizeIngredientsJson(parseJsonArrayInput(ingredients_json));
        if (normalizedIngredients.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Danh sách nguyên liệu là bắt buộc' });
        }

        const normalizedSteps = normalizeStepsJson(parseJsonArrayInput(steps_json));
        if (normalizedSteps.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Các bước thực hiện là bắt buộc' });
        }

        const normalizedDishType = normalizeDishType(dish_type);
        if (!normalizedDishType) {
            return res.status(400).json({ status: 'error', message: 'Loại món phải là MAIN_DISH, SIDE_DISH hoặc DESSERT' });
        }

        const normalizedDifficulty = normalizeDifficulty(difficulty);
        if (!normalizedDifficulty) {
            return res.status(400).json({ status: 'error', message: 'Độ khó phải là EASY, MEDIUM hoặc HARD' });
        }

        const normalizedTotalCalories = parsePositiveNumber(total_calories);
        if (normalizedTotalCalories === null) {
            return res.status(400).json({ status: 'error', message: 'Calories phải là số lớn hơn 0' });
        }

        const normalizedCookingTime = parsePositiveInteger(cooking_time);
        if (normalizedCookingTime === null) {
            return res.status(400).json({ status: 'error', message: 'Thời gian nấu phải là số nguyên lớn hơn 0 (phút)' });
        }

        const insertResult = await db.query(
            `INSERT INTO recipe_submission (
                submitter_id,
                title,
                description,
                ingredients_json,
                steps_json,
                dish_type,
                image_url,
                temp_image_path,
                total_calories,
                cooking_time,
                difficulty,
                status,
                created_at,
                updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            RETURNING submission_id, status, created_at`,
            [
                req.authUser.user_id,
                normalizedTitle,
                String(description || '').trim() || null,
                JSON.stringify(normalizedIngredients),
                JSON.stringify(normalizedSteps),
                normalizedDishType,
                uploadedTempImagePath ? null : (String(image_url || '').trim() || null),
                uploadedTempImagePath,
                normalizedTotalCalories,
                normalizedCookingTime,
                normalizedDifficulty,
            ]
        );

        return res.status(201).json({
            status: 'success',
            message: 'Đã gửi công thức chờ admin duyệt',
            submission: insertResult.rows[0],
        });
    } catch (error) {
        if (uploadedTempImagePath) {
            safeUnlink(uploadedTempImagePath);
        }
        console.error('❌ Lỗi tạo recipe submission:', error.message);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi gửi công thức' });
    }
});

app.get('/api/recipes/submissions/me', authenticateAccessToken, async (req, res) => {
    try {
        await ensureRecipeSubmissionTableReady();

        const result = await db.query(
            `SELECT
                rs.submission_id,
                rs.title,
                rs.description,
                rs.status,
                rs.reject_reason,
                rs.created_at,
                rs.reviewed_at,
                rs.linked_recipe_id,
                rs.total_calories,
                rs.cooking_time,
                rs.difficulty,
                rs.dish_type
             FROM recipe_submission rs
             WHERE rs.submitter_id = $1
             ORDER BY rs.created_at DESC`,
            [req.authUser.user_id]
        );

        return res.json({ status: 'success', submissions: result.rows });
    } catch (error) {
        console.error('❌ Lỗi lấy recipe submission của user:', error.message);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi tải trạng thái duyệt' });
    }
});

app.get('/api/admin/recipe-submissions', authenticateAccessToken, async (req, res) => {
    try {
        if (!(await ensureAdminRole(req, res))) {
            return;
        }

        await ensureRecipeSubmissionTableReady();

        const statusFilterRaw = String(req.query.status || 'ALL').trim().toUpperCase();
        const allowedStatuses = new Set(['ALL', 'PENDING', 'APPROVED', 'REJECTED']);
        const statusFilter = allowedStatuses.has(statusFilterRaw) ? statusFilterRaw : 'ALL';

        const query = statusFilter === 'ALL'
            ? `SELECT
                    rs.submission_id,
                    rs.submitter_id,
                    rs.title,
                    rs.description,
                    rs.ingredients_json,
                    rs.steps_json,
                    rs.dish_type,
                    rs.image_url,
                    rs.total_calories,
                    rs.cooking_time,
                    rs.difficulty,
                    rs.status,
                    rs.reject_reason,
                    rs.reviewed_by,
                    rs.reviewed_at,
                    rs.linked_recipe_id,
                    rs.created_at,
                    COALESCE(u.full_name, u.email, 'Người dùng') AS submitter_name
               FROM recipe_submission rs
               LEFT JOIN app_user u ON u.user_id = rs.submitter_id
               ORDER BY rs.created_at DESC`
            : `SELECT
                    rs.submission_id,
                    rs.submitter_id,
                    rs.title,
                    rs.description,
                    rs.ingredients_json,
                    rs.steps_json,
                    rs.dish_type,
                    rs.image_url,
                    rs.total_calories,
                    rs.cooking_time,
                    rs.difficulty,
                    rs.status,
                    rs.reject_reason,
                    rs.reviewed_by,
                    rs.reviewed_at,
                    rs.linked_recipe_id,
                    rs.created_at,
                    COALESCE(u.full_name, u.email, 'Người dùng') AS submitter_name
               FROM recipe_submission rs
               LEFT JOIN app_user u ON u.user_id = rs.submitter_id
               WHERE rs.status = $1
               ORDER BY rs.created_at DESC`;

        const result = statusFilter === 'ALL'
            ? await db.query(query)
            : await db.query(query, [statusFilter]);

        return res.json({ status: 'success', submissions: result.rows });
    } catch (error) {
        console.error('❌ Lỗi lấy admin recipe submissions:', error.message);
        return res.status(500).json({ status: 'error', message: 'Lỗi server khi tải danh sách chờ duyệt' });
    }
});

app.patch('/api/admin/recipe-submissions/:id/review', authenticateAccessToken, async (req, res) => {
    const client = await db.getClient();
    try {
        if (!(await ensureAdminRole(req, res))) {
            return;
        }

        await ensureRecipeSubmissionTableReady();

        const submissionId = Number(req.params.id);
        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return res.status(400).json({ status: 'error', message: 'ID submission không hợp lệ' });
        }

        const action = String(req.body?.action || '').trim().toUpperCase();
        const rejectReason = String(req.body?.reject_reason || '').trim();

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ status: 'error', message: 'Action phải là APPROVE hoặc REJECT' });
        }

        await client.query('BEGIN');

        const submissionResult = await client.query(
            `SELECT *
             FROM recipe_submission
             WHERE submission_id = $1
             LIMIT 1`,
            [submissionId]
        );

        const submission = submissionResult.rows[0];
        if (!submission) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: 'Không tìm thấy submission' });
        }

        if (String(submission.status || '').toUpperCase() !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(409).json({ status: 'error', message: 'Submission đã được xử lý trước đó' });
        }

        if (action === 'REJECT') {
            const tempImageToDelete = submission.temp_image_path || null;
            const rejected = await client.query(
                `UPDATE recipe_submission
                 SET status = 'REJECTED',
                     reject_reason = $2,
                     reviewed_by = $3,
                     reviewed_at = CURRENT_TIMESTAMP,
                     temp_image_path = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE submission_id = $1
                 RETURNING submission_id, status, reject_reason, reviewed_at`,
                [submissionId, rejectReason || 'Không đạt yêu cầu kiểm duyệt', req.authUser.user_id]
            );

            await client.query('COMMIT');
            safeUnlink(tempImageToDelete);
            return res.json({ status: 'success', submission: rejected.rows[0] });
        }

        let approvedImageUrl = submission.image_url || null;
        if (submission.temp_image_path) {
            const uploadedImage = await uploadImageFromPath({
                filePath: submission.temp_image_path,
                scope: 'recipes',
                entityId: `submission-${submission.submission_id}`,
                suffix: Date.now(),
            });
            approvedImageUrl = uploadedImage.imageUrl;
        }

        const approvedTitle = capitalizeWords(submission.title || '');
        const approvedIngredientsRaw = normalizeIngredientsJson(submission.ingredients_json);
        const approvedIngredients = await enrichIngredientsWithIds(client, approvedIngredientsRaw);
        const approvedSteps = normalizeStepsJson(submission.steps_json);
        const approvedDishType = normalizeDishType(submission.dish_type);
        const approvedDifficulty = normalizeDifficulty(submission.difficulty);
        const approvedCalories = parsePositiveNumber(submission.total_calories);
        const approvedCookingTime = parsePositiveInteger(submission.cooking_time);

        // Allow approving legacy submissions that may miss optional metadata.
        if (!approvedTitle || approvedIngredients.length === 0 || approvedSteps.length === 0) {
            throw new AppError('Submission thiếu tiêu đề, nguyên liệu hoặc bước nấu nên chưa thể duyệt.', 422);
        }

        const createdRecipe = await client.query(
            `INSERT INTO recipe (
                author_id,
                title,
                description,
                ingredients_json,
                steps_json,
                dish_type,
                image_url,
                total_calories,
                cooking_time,
                difficulty,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING recipe_id`,
            [
                submission.submitter_id,
                approvedTitle,
                submission.description,
                JSON.stringify(approvedIngredients),
                JSON.stringify(approvedSteps),
                approvedDishType,
                approvedImageUrl,
                approvedCalories,
                approvedCookingTime,
                approvedDifficulty,
                'APPROVED'
            ]
        );

        const newRecipeId = createdRecipe.rows[0].recipe_id;
        const ingredientIds = approvedIngredients
            .map((item) => Number(item?.id || item?.ingredient_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (ingredientIds.length > 0) {
            await client.query(
                `INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
                 SELECT $1, ingredient_id
                 FROM UNNEST($2::int[]) AS ingredient_id
                 ON CONFLICT (recipe_id, ingredient_id) DO NOTHING`,
                [newRecipeId, [...new Set(ingredientIds)]]
            );
        }

        const approved = await client.query(
            `UPDATE recipe_submission
             SET status = 'APPROVED',
                 reviewed_by = $2,
                 reviewed_at = CURRENT_TIMESTAMP,
                 linked_recipe_id = $3,
                 image_url = $4,
                 temp_image_path = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE submission_id = $1
             RETURNING submission_id, status, linked_recipe_id, reviewed_at`,
            [submissionId, req.authUser.user_id, newRecipeId, approvedImageUrl]
        );

        await client.query('COMMIT');
        safeUnlink(submission.temp_image_path);

        // Hook cập nhật thành tựu (không đợi vì không muốn làm chậm response)
        updateAchievementProgress(submission.submitter_id, 'RECIPE_COUNT').catch(console.error);

        return res.json({ status: 'success', submission: approved.rows[0] });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        console.error('❌ Lỗi review recipe submission:', error.message);
        const statusCode = Number(error?.statusCode) || 500;
        return res.status(statusCode).json({
            status: 'error',
            message: statusCode >= 500 ? 'Lỗi server khi duyệt công thức' : (error.message || 'Không thể duyệt công thức'),
        });
    } finally {
        client.release();
    }
});

app.post('/api/recipes/:id/favorite', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const recipeResult = await db.query(
            `SELECT recipe_id
             FROM recipe
             WHERE recipe_id = $1
             LIMIT 1`,
            [recipeId]
        );
        if (!recipeResult.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        await db.query(
            `INSERT INTO favorite_recipe (user_id, recipe_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, recipe_id) DO NOTHING`,
            [req.authUser.user_id, recipeId]
        );

        // Hook cập nhật thành tựu
        updateAchievementProgress(req.authUser.user_id, 'FAVORITE_COUNT').catch(console.error);

        const likeCountResult = await db.query(
            `SELECT COUNT(*)::int AS like_count
             FROM favorite_recipe
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: true,
            likeCount: likeCountResult.rows[0]?.like_count || 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API add favorite:', error.message);
        return res.status(500).json({ error: 'Lỗi thêm yêu thích công thức' });
    }
});

app.delete('/api/recipes/:id/favorite', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        await db.query(
            `DELETE FROM favorite_recipe
             WHERE user_id = $1
               AND recipe_id = $2`,
            [req.authUser.user_id, recipeId]
        );

        const likeCountResult = await db.query(
            `SELECT COUNT(*)::int AS like_count
             FROM favorite_recipe
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: false,
            likeCount: likeCountResult.rows[0]?.like_count || 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API remove favorite:', error.message);
        return res.status(500).json({ error: 'Lỗi bỏ yêu thích công thức' });
    }
});

app.post('/api/meal-sets/favorite', authenticateAccessToken, async (req, res) => {
    const client = await db.getClient();

    try {
        const {
            name,
            targetCalories,
            mealType,
            goalType,
            imageUrl,
            recipeIds,
        } = req.body || {};

        const normalizedRecipeIds = [...new Set(
            (Array.isArray(recipeIds) ? recipeIds : [])
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        if (normalizedRecipeIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Danh sách món ăn không hợp lệ',
            });
        }

        const normalizedGoalInput = String(goalType || '').trim().toUpperCase();
        const goalTypeMap = {
            LOSE: 'LOSE_WEIGHT',
            LOSE_WEIGHT: 'LOSE_WEIGHT',
            MAINTAIN: 'MAINTAIN',
            GAIN: 'GAIN_WEIGHT',
            GAIN_WEIGHT: 'GAIN_WEIGHT',
        };
        const dbGoalType = goalTypeMap[normalizedGoalInput] || 'MAINTAIN';

        const targetCaloriesValue = Number(targetCalories);
        const sanitizedTargetCalories = Number.isFinite(targetCaloriesValue)
            ? Math.max(0, Math.round(targetCaloriesValue * 100) / 100)
            : null;

        await client.query('BEGIN');

        const recipeExistResult = await client.query(
            `SELECT COUNT(*)::int AS matched_count
             FROM recipe
             WHERE recipe_id = ANY($1::int[])`,
            [normalizedRecipeIds]
        );

        if (Number(recipeExistResult.rows[0]?.matched_count || 0) !== normalizedRecipeIds.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                message: 'Có món ăn không tồn tại trong hệ thống',
            });
        }

        const createdMealSet = await client.query(
            `INSERT INTO meal_set (name, target_calories, meal_type, user_id, image_url, goal_type)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING meal_set_id, name, target_calories, meal_type, user_id, image_url, goal_type, total_calories, created_at`,
            [
                String(name || '').trim() || 'Mâm cơm yêu thích',
                sanitizedTargetCalories,
                String(mealType || '').trim() || null,
                req.authUser.user_id,
                String(imageUrl || '').trim() || null,
                dbGoalType,
            ]
        );

        const mealSetId = createdMealSet.rows[0].meal_set_id;

        await client.query(
            `INSERT INTO meal_set_recipe (meal_set_id, recipe_id)
             SELECT $1, recipe_id
             FROM UNNEST($2::int[]) AS recipe_id
             ON CONFLICT (meal_set_id, recipe_id) DO NOTHING`,
            [mealSetId, normalizedRecipeIds]
        );

        await client.query(
            `INSERT INTO favorite_meal_set (user_id, meal_set_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, meal_set_id)
             DO UPDATE SET saved_at = CURRENT_TIMESTAMP`,
            [req.authUser.user_id, mealSetId]
        );

        await client.query('COMMIT');

        // Hook cập nhật thành tựu (sau khi commit thành công)
        updateAchievementProgress(req.authUser.user_id, 'MEAL_SET_COUNT').catch(console.error);

        const finalMealSet = await client.query(
            `SELECT meal_set_id, name, target_calories, total_calories, meal_type, goal_type, image_url, created_at
             FROM meal_set
             WHERE meal_set_id = $1
             LIMIT 1`,
            [mealSetId]
        );

        await client.query('COMMIT');

        return res.json({
            status: 'success',
            message: 'Đã lưu mâm cơm yêu thích',
            mealSet: finalMealSet.rows[0],
            recipeCount: normalizedRecipeIds.length,
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        console.error('❌ Lỗi API lưu meal set yêu thích:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi lưu mâm cơm yêu thích',
        });
    } finally {
        client.release();
    }
});

app.get('/api/meal-sets/favorites', authenticateAccessToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                ms.meal_set_id,
                ms.name,
                ms.meal_type,
                ms.goal_type,
                ms.target_calories,
                ms.total_calories,
                ms.image_url,
                ms.created_at,
                fms.saved_at,
                COUNT(msr.recipe_id)::int AS recipe_count
             FROM favorite_meal_set fms
             JOIN meal_set ms ON ms.meal_set_id = fms.meal_set_id
             LEFT JOIN meal_set_recipe msr ON msr.meal_set_id = ms.meal_set_id
             WHERE fms.user_id = $1
             GROUP BY ms.meal_set_id, fms.saved_at
             ORDER BY COALESCE(fms.saved_at, ms.created_at) DESC`,
            [req.authUser.user_id]
        );

        return res.json({
            status: 'success',
            mealSets: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API meal-sets/favorites:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn mâm cơm yêu thích' });
    }
});

app.get('/api/meal-sets/:id/recipes', authenticateAccessToken, async (req, res) => {
    try {
        const mealSetId = Number(req.params.id);
        if (!Number.isInteger(mealSetId) || mealSetId <= 0) {
            return res.status(400).json({ error: 'ID mâm cơm không hợp lệ' });
        }

        const favoriteResult = await db.query(
            `SELECT 1
             FROM favorite_meal_set
             WHERE user_id = $1
               AND meal_set_id = $2
             LIMIT 1`,
            [req.authUser.user_id, mealSetId]
        );

        if (!favoriteResult.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy mâm cơm yêu thích' });
        }

        const recipesResult = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.difficulty,
                r.ingredients_json
             FROM meal_set_recipe msr
             JOIN recipe r ON r.recipe_id = msr.recipe_id
             WHERE msr.meal_set_id = $1
             ORDER BY r.recipe_id DESC`,
            [mealSetId]
        );

        return res.json({
            status: 'success',
            recipes: recipesResult.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API meal-sets/:id/recipes:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn món trong mâm cơm yêu thích' });
    }
});

app.get('/api/internal/cloudinary-config', asyncHandler(async (req, res) => {
    const config = getCloudinaryConfigSummary();
    res.json({
        status: 'success',
        cloudinary: config,
    });
}));

// API AUTH: EMAIL/PASSWORD
app.post('/api/auth/register', asyncHandler(async (req, res) => {
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
}));

app.post('/api/auth/login', async (req, res) => {
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
});

app.post('/api/auth/refresh', async (req, res) => {
    try {
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
});

app.post('/api/auth/logout', async (req, res) => {
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
});

const socialAuthHandler = async (req, res) => {
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

// API social login (payload nhận từ mobile sau khi xác thực ở SDK client)
app.post('/api/auth/social/google', socialAuthHandler);

app.get('/api/auth/me', authenticateAccessToken, async (req, res) => {
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
});

// Endpoint kiểm tra trạng thái 1 giao dịch cụ thể (dùng để polling từ mobile)
app.get('/api/payments/:id/status', authenticateAccessToken, asyncHandler(async (req, res) => {
    const paymentId = req.params.id;
    const result = await db.query(
        "SELECT status, payment_id, internal_reference, amount FROM payment WHERE payment_id = $1 AND user_id = $2",
        [paymentId, req.authUser.user_id]
    );

    if (!result.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Không tìm thấy giao dịch' });
    }

    res.json({ status: 'success', payment: result.rows[0] });
}));



// --- ADMIN INGREDIENTS API ---
app.post('/api/admin/upload/recipe-image', authenticateAccessToken, upload.single('image'), asyncHandler(async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }
    if (!req.file) {
        throw new AppError('Không có file được tải lên', 400);
    }

    try {
        const result = await uploadImageFromPath({
            filePath: req.file.path,
            scope: 'recipes',
            entityId: 'admin',
            suffix: Date.now(),
        });
        res.json({ status: 'success', imageUrl: result.imageUrl, publicId: result.publicId });
    } catch (error) {
        throw new AppError(`Lỗi upload ảnh: ${error.message}`, 500);
    } finally {
        try { 
            if (req.file?.path) fs.unlinkSync(req.file.path); 
        } catch (_) {}
    }
}));

app.get('/api/admin/stats', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.post('/api/admin/upload/ingredient-image', authenticateAccessToken, upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
        console.warn('❌ Upload ảnh: Không nhận được file');
        throw new AppError('Không có file được tải lên', 400);
    }

    try {
        console.log(`📁 Upload ảnh từ: ${req.file.path}`);
        const result = await uploadImageFromPath({
            filePath: req.file.path,
            scope: 'ingredients',
            entityId: 'img',
            suffix: Date.now(),
        });
        console.log(`✅ Upload ảnh thành công: ${result.imageUrl}`);
        res.json({ status: 'success', imageUrl: result.imageUrl, publicId: result.publicId });
    } catch (error) {
        console.error('❌ Lỗi upload ảnh:', error.message);
        throw new AppError(`Lỗi upload ảnh: ${error.message}`, 500);
    } finally {
        try { 
            if (req.file?.path) fs.unlinkSync(req.file.path); 
        } catch (_) {}
    }
}));

app.get('/api/admin/ingredients', authenticateAccessToken, asyncHandler(async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const result = await db.query(
        `SELECT ingredient_id, name, type, image_url, is_common, keywords, status
         FROM ingredient
         WHERE status = $1
         ORDER BY ingredient_id ASC`
        , [INGREDIENT_STATUS_ACTIVE]
    );
    console.log(`✅ Lấy danh sách nguyên liệu: ${result.rows.length} items`);
    res.json({ status: 'success', ingredients: result.rows });
}));

app.post('/api/admin/ingredients', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.put('/api/admin/ingredients/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.delete('/api/admin/ingredients/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.get('/api/admin/recipes', authenticateAccessToken, asyncHandler(async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const result = await db.query(
       `SELECT
           r.recipe_id,
           r.title,
           r.description,
           r.ingredients_json,
           r.steps_json,
           r.image_url,
           r.total_calories,
           r.cooking_time,
           r.difficulty,
           r.dish_type,
           r.status,
           r.created_at,
           COALESCE(u.full_name, 'NutriChef') AS author_name,
           COUNT(DISTINCT msr.meal_set_id)::int AS in_meal_set_count,
           COUNT(DISTINCT fr.user_id)::int AS favorite_count
        FROM recipe r
        LEFT JOIN app_user u ON u.user_id = r.author_id
        LEFT JOIN meal_set_recipe msr ON msr.recipe_id = r.recipe_id
        LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
        WHERE r.status != 'HIDDEN'
        GROUP BY r.recipe_id, u.full_name
        ORDER BY r.created_at DESC, r.recipe_id DESC`
    );
    res.json({ status: 'success', recipes: result.rows });
}));

app.post('/api/admin/recipes', authenticateAccessToken, asyncHandler(async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const {
        title,
        description,
        ingredients_json,
        steps_json,
        dish_type,
        image_url,
        total_calories,
        cooking_time,
        difficulty,
    } = req.body || {};

    const normalizedTitle = capitalizeWords(title || '');
    if (!normalizedTitle) {
        throw new AppError('Tên công thức là bắt buộc', 400);
    }

    const normalizedIngredients = normalizeIngredientsJson(ingredients_json);
    if (normalizedIngredients.length === 0) {
        throw new AppError('Danh sách nguyên liệu là bắt buộc', 400);
    }

    const normalizedSteps = normalizeStepsJson(steps_json);
    if (normalizedSteps.length === 0) {
        throw new AppError('Các bước thực hiện là bắt buộc', 400);
    }

    const normalizedDishType = normalizeDishType(dish_type);
    if (!normalizedDishType) {
        throw new AppError('Loại món phải là MAIN_DISH, SIDE_DISH hoặc DESSERT', 400);
    }

    const normalizedDifficulty = normalizeDifficulty(difficulty);
    if (!normalizedDifficulty) {
        throw new AppError('Độ khó phải là EASY, MEDIUM hoặc HARD', 400);
    }

    const normalizedTotalCalories = parsePositiveNumber(total_calories);
    if (normalizedTotalCalories === null) {
        throw new AppError('Calories phải là số lớn hơn 0', 400);
    }

    const normalizedCookingTime = parsePositiveInteger(cooking_time);
    if (normalizedCookingTime === null) {
        throw new AppError('Thời gian nấu phải là số nguyên lớn hơn 0 (phút)', 400);
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const normalizedIngredientsWithIds = await enrichIngredientsWithIds(client, normalizedIngredients);

        const inserted = await client.query(
            `INSERT INTO recipe (
                author_id,
                title,
                description,
                ingredients_json,
                steps_json,
                dish_type,
                image_url,
                total_calories,
                cooking_time,
                difficulty,
                status,
                created_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'APPROVED',CURRENT_TIMESTAMP)
            RETURNING recipe_id, title, description, image_url, total_calories, cooking_time, difficulty, dish_type, created_at`,
            [
                req.authUser.user_id,
                normalizedTitle,
                String(description || '').trim() || null,
                JSON.stringify(normalizedIngredientsWithIds),
                JSON.stringify(normalizedSteps),
                normalizedDishType,
                image_url || null,
                normalizedTotalCalories,
                normalizedCookingTime,
                normalizedDifficulty,
            ]
        );

        const recipeId = inserted.rows[0].recipe_id;
        const ingredientIds = normalizedIngredientsWithIds
            .map((item) => Number(item?.id || item?.ingredient_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (ingredientIds.length > 0) {
            await client.query(
                `INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
                 SELECT $1, ingredient_id
                 FROM UNNEST($2::int[]) AS ingredient_id
                 ON CONFLICT (recipe_id, ingredient_id) DO NOTHING`,
                [recipeId, [...new Set(ingredientIds)]]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ status: 'success', recipe: inserted.rows[0] });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        throw error;
    } finally {
        client.release();
    }
}));

app.put('/api/admin/recipes/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID không hợp lệ', 400);

    const {
        title,
        description,
        ingredients_json,
        steps_json,
        dish_type,
        image_url,
        total_calories,
        cooking_time,
        difficulty,
    } = req.body || {};

    const normalizedTitle = capitalizeWords(title || '');
    if (!normalizedTitle) throw new AppError('Tên công thức là bắt buộc', 400);

    const normalizedIngredients = normalizeIngredientsJson(ingredients_json);
    const normalizedSteps = normalizeStepsJson(steps_json);
    const normalizedDishType = normalizeDishType(dish_type);
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const normalizedTotalCalories = parsePositiveNumber(total_calories);
    const normalizedCookingTime = parsePositiveInteger(cooking_time);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        const normalizedIngredientsWithIds = await enrichIngredientsWithIds(client, normalizedIngredients);

        const updateResult = await client.query(
            `UPDATE recipe 
             SET title = $1, description = $2, ingredients_json = $3, steps_json = $4, 
                 dish_type = $5, image_url = $6, total_calories = $7, 
                 cooking_time = $8, difficulty = $9
             WHERE recipe_id = $10
             RETURNING recipe_id`,
            [
                normalizedTitle,
                description || null,
                JSON.stringify(normalizedIngredientsWithIds),
                JSON.stringify(normalizedSteps),
                normalizedDishType,
                image_url || null,
                normalizedTotalCalories,
                normalizedCookingTime,
                normalizedDifficulty,
                id
            ]
        );

        if (updateResult.rows.length === 0) {
            throw new AppError('Công thức không tồn tại', 404);
        }

        // Update ingredient mapping
        await client.query('DELETE FROM recipe_ingredient_map WHERE recipe_id = $1', [id]);
        const ingredientIds = normalizedIngredientsWithIds
            .map((item) => Number(item?.id || item?.ingredient_id))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (ingredientIds.length > 0) {
            await client.query(
                `INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
                 SELECT $1, ingredient_id
                 FROM UNNEST($2::int[]) AS ingredient_id
                 ON CONFLICT (recipe_id, ingredient_id) DO NOTHING`,
                [id, [...new Set(ingredientIds)]]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'success', recipeId: id });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

app.delete('/api/admin/recipes/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
    if (!(await ensureAdminRole(req, res))) {
        return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID không hợp lệ', 400);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        
        const result = await client.query(
            `UPDATE recipe 
             SET status = 'HIDDEN'
             WHERE recipe_id = $1 
             RETURNING recipe_id`,
            [id]
        );
        
        if (result.rows.length === 0) {
            throw new AppError('Công thức không tồn tại', 404);
        }

        await client.query('COMMIT');
        res.json({ status: 'success', message: 'Đã ẩn công thức' });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Khởi tạo các bảng đồng bộ hơn hoặc log lỗi chi tiết
(async () => {
    try {
        await ensureIngredientSoftDeleteReady();
        await ensureAchievementTablesReady();
        console.log('✅ Hệ thống thành tựu đã sẵn sàng');
    } catch (error) {
        console.error('❌ Lỗi khởi tạo hệ thống:', error.message);
    }
})();

// --- ACHIEVEMENT API ---
app.get('/api/achievements', authenticateAccessToken, asyncHandler(async (req, res) => {
    try {
        console.log(`[API] GET /api/achievements - User: ${req.authUser?.user_id}`);
        const achievements = await getUserAchievements(req.authUser.user_id);
        
        // Đảm bảo luôn trả về JSON hợp lệ
        return res.status(200).json({ 
            status: 'success', 
            achievements: achievements || [] 
        });
    } catch (error) {
        console.error('❌ Lỗi API achievements:', error.message);
        // Trả về JSON lỗi thay vì để errorHandler xử lý (để tránh rủi ro trả về HTML)
        return res.status(500).json({ 
            status: 'error', 
            message: 'Không thể lấy danh sách thành tựu: ' + error.message 
        });
    }
}));

app.post('/api/achievements/equip-title', authenticateAccessToken, asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    // title có thể là null để tháo danh hiệu
    await equipTitle(req.authUser.user_id, title || null);
    res.json({ status: 'success', message: 'Cập nhật danh hiệu thành công' });
}));

// --- PREMIUM PLANS & PAYMENTS ---
app.get('/api/premium-plans', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT plan_id, plan_name, price, duration_days, description FROM premium_plan WHERE is_active = true ORDER BY price ASC'
        );
        res.json({ status: 'success', plans: result.rows });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách gói premium:', error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách gói' });
    }
});

// Endpoint nhận Webhook từ SePay
app.post('/api/webhooks/sepay', asyncHandler(async (req, res) => {
    const fs = require('fs');
    const logData = `
--- ${new Date().toLocaleString()} ---
Headers: ${JSON.stringify(req.headers, null, 2)}
Body: ${JSON.stringify(req.body, null, 2)}
---------------------------
`;
    fs.appendFileSync('sepay_webhook.log', logData);

    console.log('--- 📩 Nhận Webhook SePay ---');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('---------------------------');

    const { 
        content, 
        transferAmount,
        amount,
        id,
        referenceCode,
        transactionDate,
        transfer_date,
        transaction_id
    } = req.body || {};
    
    // Support field names từ SePay
    const paymentAmount = transferAmount || amount;
    const txId = referenceCode || id || transaction_id;
    const txDate = transactionDate || transfer_date;

    if (!content) {
        return res.json({ status: 'ignored', message: 'No content found' });
    }

    // 1. Tìm giao dịch PENDING hoặc đang xử lý
    // Tìm kiếm: internal_reference match hoặc content chứa internal_reference
    const paymentResult = await db.query(
        "SELECT * FROM payment WHERE (internal_reference = $1 OR internal_reference ILIKE '%' || $1 || '%' OR $1 ILIKE '%' || internal_reference || '%') ORDER BY create_at DESC LIMIT 1",
        [content.trim()]
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
        console.warn(`⚠️ Không tìm thấy giao dịch khớp với nội dung: ${content}`);
        return res.json({ status: 'ignored', message: 'No matching payment' });
    }
    
    console.log(`✅ Tìm thấy payment ID: ${payment.payment_id}, Status: ${payment.status}, Ref: ${payment.internal_reference}`);
    
    // Nếu đã xử lý rồi thì bỏ qua
    if (payment.status === 'SUCCESS') {
        console.log(`ℹ️ Payment đã xử lý thành công trước đó`);
        return res.json({ status: 'already_processed', message: 'Payment already successful' });
    }

    // 2. Kiểm tra số tiền (Cho phép sai số nhỏ dưới 100đ)
    const diff = Math.abs(parseFloat(paymentAmount) - parseFloat(payment.amount));
    if (diff > 100) {
        console.warn(`⚠️ Số tiền không khớp. SePay: ${paymentAmount}, DB: ${payment.amount}`);
        return res.json({ status: 'error', message: 'Amount mismatch' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 3. Cập nhật trạng thái giao dịch
        await client.query(
            `UPDATE payment 
             SET status = 'SUCCESS', 
                 transaction_code = $1, 
                 paid_at = $2 
             WHERE payment_id = $3`,
            [txId || `SEPAY_${Date.now()}`, txDate || new Date(), payment.payment_id]
        );

        // 4. Lấy thông tin gói
        const planResult = await client.query('SELECT duration_days FROM premium_plan WHERE plan_id = $1', [payment.plan_id]);
        const durationDays = planResult.rows[0]?.duration_days || 30;

        // 5. Thêm vào lịch sử Premium
        await client.query(
            `INSERT INTO user_premium_history (user_id, plan_id, payment_id, start_date, end_date)
             VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval)
             ON CONFLICT (payment_id) DO NOTHING`,
            [payment.user_id, payment.plan_id, payment.payment_id, durationDays]
        );

        // 6. Gán Role PREMIUM_USER
        await client.query(
            `INSERT INTO user_role (user_id, role_id)
             SELECT $1, role_id FROM role WHERE role_name = 'PREMIUM_USER'
             ON CONFLICT DO NOTHING`,
            [payment.user_id]
        );

        await client.query('COMMIT');
        console.log(`✅ Nâng cấp thành công cho User ID: ${payment.user_id}`);
        res.json({ status: 'success', message: 'Payment processed successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi xử lý Webhook SePay:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
}));

app.get('/api/admin/payments', authenticateAccessToken, asyncHandler(async (req, res) => {
    if (!(await ensureAdminRole(req, res))) return;

    const result = await db.query(
        `SELECT 
            p.payment_id, 
            p.user_id, 
            p.plan_id, 
            p.amount, 
            p.status, 
            p.transaction_code, 
            p.paid_at, 
            p.create_at,
            u.full_name as user_name,
            u.email as user_email,
            pl.plan_name
         FROM payment p
         JOIN app_user u ON p.user_id = u.user_id
         JOIN premium_plan pl ON p.plan_id = pl.plan_id
         ORDER BY p.create_at DESC`
    );

    res.json({ status: 'success', payments: result.rows });
}));

app.post('/api/payments', authenticateAccessToken, asyncHandler(async (req, res) => {
    const { plan_id } = req.body || {};
    if (!plan_id) {
        throw new AppError('Thiếu thông tin gói nâng cấp', 400);
    }

    const planResult = await db.query('SELECT * FROM premium_plan WHERE plan_id = $1 AND is_active = true', [plan_id]);
    const plan = planResult.rows[0];
    if (!plan) throw new AppError('Gói không tồn tại hoặc đã ngừng cung cấp', 404);

    const internalRef = `PAY${req.authUser.user_id}T${Math.floor(Date.now() / 1000)}`;
    const result = await db.query(
        `INSERT INTO payment (user_id, plan_id, amount, internal_reference, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING *`,
        [req.authUser.user_id, plan.plan_id, plan.price, internalRef]
    );

    res.status(201).json({ status: 'success', payment: result.rows[0] });
}));

// --- ADMIN USER MANAGEMENT ---
app.get('/api/admin/users', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.get('/api/admin/users/:id/recipes', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.post('/api/admin/users', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.put('/api/admin/users/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.delete('/api/admin/users/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
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
}));

app.use(errorHandler);

const server = app.listen(port, () => {
    console.log(`🚀 Server Node.js đang chạy tại http://localhost:${port}`);
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        console.error(`❌ Cổng ${port} đã được sử dụng. Hãy tắt tiến trình cũ rồi chạy lại server.`);
        process.exit(1);
    }

    console.error('❌ Lỗi server:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('SIGINT', () => {
    console.log('🛑 Đang tắt server...');
    server.close(() => {
        console.log('✅ Server đã tắt.');
        process.exit(0);
    });
});