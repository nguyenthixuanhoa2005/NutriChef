const AppError = require('./AppError');

const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const isKnownError = error instanceof AppError || Boolean(error?.isOperational);
    const statusCode = Number(error?.statusCode) || 500;
    const message = error?.message || 'Lỗi server';

    if (!isKnownError) {
        console.error('❌ Unhandled error:', error);
    }

    const payload = {
        status: 'error',
        message,
    };

    if (error?.details) {
        payload.details = error.details;
    }

    return res.status(statusCode).json(payload);
};

module.exports = errorHandler;
