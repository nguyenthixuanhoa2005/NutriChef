const { v2: cloudinary } = require('cloudinary');
const AppError = require('../errors/AppError');

const CLOUDINARY_BASE_FOLDER = String(process.env.CLOUDINARY_BASE_FOLDER || 'app-goi-y').trim();

let configured = false;

const ensureConfigured = () => {
    if (configured) {
        return cloudinary;
    }

    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

    if (!cloudName || !apiKey || !apiSecret) {
        throw new AppError('Thiếu cấu hình Cloudinary environment variables', 500, {
            required: [
                'CLOUDINARY_CLOUD_NAME',
                'CLOUDINARY_API_KEY',
                'CLOUDINARY_API_SECRET',
            ],
        });
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    configured = true;
    return cloudinary;
};

const sanitizeSegment = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildFolder = (scope) => {
    const sanitizedScope = sanitizeSegment(scope);
    if (!sanitizedScope) {
        throw new AppError('Folder upload Cloudinary không hợp lệ', 400);
    }

    return `${CLOUDINARY_BASE_FOLDER}/${sanitizedScope}`;
};

const buildPublicId = ({ scope, entityId, suffix }) => {
    const sanitizedScope = sanitizeSegment(scope);
    const sanitizedEntityId = sanitizeSegment(entityId);
    const sanitizedSuffix = sanitizeSegment(suffix || Date.now());

    if (!sanitizedScope || !sanitizedEntityId) {
        throw new AppError('public_id Cloudinary không hợp lệ', 400);
    }

    return `${sanitizedScope}/${sanitizedEntityId}-${sanitizedSuffix}`;
};

const normalizeUploadResult = (result) => ({
    publicId: result.public_id,
    imageUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
    resourceType: result.resource_type,
});

const uploadImageFromPath = async ({
    filePath,
    scope,
    entityId,
    suffix,
    transformation = [],
    overwrite = true,
    tags = [],
}) => {
    if (!filePath) {
        throw new AppError('Thiếu filePath để upload Cloudinary', 400);
    }

    const client = ensureConfigured();
    const folder = buildFolder(scope);
    const publicId = buildPublicId({ scope, entityId, suffix });

    const result = await client.uploader.upload(filePath, {
        folder,
        public_id: publicId,
        resource_type: 'image',
        overwrite,
        invalidate: true,
        tags,
        transformation,
    });

    return normalizeUploadResult(result);
};

const destroyImage = async (publicId) => {
    if (!publicId) {
        return { result: 'not_found' };
    }

    const client = ensureConfigured();
    return client.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
    });
};

const getCloudinaryConfigSummary = () => ({
    cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    baseFolder: CLOUDINARY_BASE_FOLDER,
    configured: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ),
});

module.exports = {
    buildFolder,
    buildPublicId,
    destroyImage,
    ensureConfigured,
    getCloudinaryConfigSummary,
    uploadImageFromPath,
};
