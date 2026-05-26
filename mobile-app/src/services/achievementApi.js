
import { authRequest } from './client';

/**
 * Lấy danh sách thành tựu và tiến độ
 */
export const getAchievements = async () => {
    try {
        // Achievement endpoint trên backend là app.get('/api/achievements', ...)
        const response = await authRequest('/api/achievements');
        return response; // authRequest đã gọi parseResponse() và trả về data
    } catch (error) {
        console.error('Lỗi lấy danh sách thành tựu:', error);
        throw error;
    }
};

/**
 * Trang bị danh hiệu
 * @param {string|null} title Tên danh hiệu hoặc null để tháo
 */
export const equipTitle = async (title) => {
    try {
        const response = await authRequest('/api/achievements/equip-title', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title }),
        });
        return response;
    } catch (error) {
        console.error('Lỗi trang bị danh hiệu:', error);
        throw error;
    }
};
