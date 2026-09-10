'use strict';

const db = require('../config/db');
const AppError = require('../errors/AppError');

// GET /api/premium-plans
const getPremiumPlans = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT plan_id, plan_name, price, duration_days, description FROM premium_plan WHERE is_active = true ORDER BY price ASC'
        );
        res.json({ status: 'success', plans: result.rows });
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách gói premium:', error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách gói' });
    }
};

// POST /api/payments
const createPayment = async (req, res) => {
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
};

// GET /api/payments/:id/status
const getPaymentStatus = async (req, res) => {
    const paymentId = req.params.id;
    const result = await db.query(
        "SELECT status, payment_id, internal_reference, amount FROM payment WHERE payment_id = $1 AND user_id = $2",
        [paymentId, req.authUser.user_id]
    );

    if (!result.rows[0]) {
        return res.status(404).json({ status: 'error', message: 'Không tìm thấy giao dịch' });
    }

    res.json({ status: 'success', payment: result.rows[0] });
};

module.exports = { getPremiumPlans, createPayment, getPaymentStatus };
