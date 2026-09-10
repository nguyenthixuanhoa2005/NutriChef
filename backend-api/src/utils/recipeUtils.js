'use strict';

const fs = require('fs');
const AppError = require('../errors/AppError');

// --- VALIDATION ---
const LOGIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const requireBodyField = (value, message) => {
    if (!value) {
        throw new AppError(message, 400);
    }
};

// --- TEXT UTILS ---
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

// --- RECIPE NORMALIZATION ---
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

// --- NUMBER PARSERS ---
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

// --- JSON HELPERS ---
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

// --- FILE UTILS ---
const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (_) {}
};

// --- INGREDIENT UTILS ---
const normalizeIngredientLookupKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

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

// --- STEPS NORMALIZATION ---
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

// --- AI KEYWORD EXPANSION ---
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

module.exports = {
    LOGIN_EMAIL_REGEX,
    LOGIN_PASSWORD_POLICY_REGEX,
    requireBodyField,
    normalizeText,
    capitalizeWords,
    ALLOWED_DISH_TYPES,
    ALLOWED_DIFFICULTIES,
    normalizeDishType,
    normalizeDifficulty,
    parsePositiveNumber,
    parsePositiveInteger,
    parseJsonArrayInput,
    safeUnlink,
    normalizeIngredientLookupKey,
    normalizeIngredientsJson,
    enrichIngredientsWithIds,
    normalizeStepsJson,
    expandAiKeywords,
};
