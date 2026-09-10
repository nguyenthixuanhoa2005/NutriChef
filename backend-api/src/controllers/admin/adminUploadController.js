'use strict';

const fs = require('fs');
const AppError = require('../../errors/AppError');
const { ensureAdminRole } = require('../../middlewares/auth');
const { uploadImageFromPath } = require('../../services/cloudinaryService');

// POST /api/admin/upload/recipe-image
const uploadRecipeImage = async (req, res) => {
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
};

// POST /api/admin/upload/ingredient-image
const uploadIngredientImage = async (req, res) => {
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
};

module.exports = { uploadRecipeImage, uploadIngredientImage };
