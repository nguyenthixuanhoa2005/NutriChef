'use strict';

const axios = require('axios');
const fs = require('fs');
const db = require('../config/db');
const {
    expandAiKeywords,
    ensureIngredientSoftDeleteReady: _ensure,
} = require('../utils/recipeUtils');
const {
    ensureIngredientSoftDeleteReady,
    INGREDIENT_STATUS_ACTIVE,
} = require('../services/dbSetupService');

const AI_SERVICE_BASE_URL = String(process.env.AI_SERVICE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 30000);

// POST /api/ai/detect-ingredients
const detectIngredients = async (req, res) => {
    try {
        const file = req.file;
        const type = req.query.type || 'image';

        if (!file) return res.status(400).json({ error: 'Vui lòng upload file' });

        // 1. Gọi sang Python Service
        const aiServiceUrl = type === 'voice'
            ? `${AI_SERVICE_BASE_URL}/detect/voice`
            : `${AI_SERVICE_BASE_URL}/detect/image`;

        const FormData = require('form-data');
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
};

// GET /api/internal/all-ingredients
const getAllIngredientsInternal = async (req, res) => {
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
};

// GET /api/ingredients
const getIngredients = async (req, res) => {
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
};

module.exports = { detectIngredients, getAllIngredientsInternal, getIngredients };
