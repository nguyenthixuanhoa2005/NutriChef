'use strict';

const express = require('express');
require('dotenv').config();
const cors = require('cors');

const errorHandler = require('./src/errors/errorHandler');
const {
    ensureIngredientSoftDeleteReady,
    ensureAchievementTablesReady,
} = require('./src/services/dbSetupService');

// Validate JWT secrets on startup
const ACCESS_TOKEN_SECRET = String(process.env.JWT_ACCESS_SECRET || '').trim();
const REFRESH_TOKEN_SECRET = String(process.env.JWT_REFRESH_SECRET || '').trim();
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error('Thiếu JWT_ACCESS_SECRET hoặc JWT_REFRESH_SECRET trong .env');
}

const app = express();
const port = Number(process.env.PORT || 3000);

// --- GLOBAL MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept'],
    credentials: true,
}));

// --- API ROUTES ---
app.use('/api', require('./src/routes/index'));

// --- ERROR HANDLER ---
app.use(errorHandler);

// --- STARTUP: ensure DB tables are ready ---
(async () => {
    try {
        await ensureIngredientSoftDeleteReady();
        await ensureAchievementTablesReady();
        console.log('✅ Hệ thống thành tựu đã sẵn sàng');
    } catch (error) {
        console.error('❌ Lỗi khởi tạo hệ thống:', error.message);
    }
})();

// --- START SERVER ---
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