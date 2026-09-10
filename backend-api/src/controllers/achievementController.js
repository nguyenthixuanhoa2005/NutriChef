'use strict';

const {
    getUserAchievements,
    equipTitle: equipTitleService,
} = require('../services/achievementService');

// GET /api/achievements
const getAchievements = async (req, res) => {
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
};

// POST /api/achievements/equip-title
const equipTitle = async (req, res) => {
    const { title } = req.body || {};
    // title có thể là null để tháo danh hiệu
    await equipTitleService(req.authUser.user_id, title || null);
    res.json({ status: 'success', message: 'Cập nhật danh hiệu thành công' });
};

module.exports = { getAchievements, equipTitle };
