'use strict';

const db = require('../../config/db');
const { ensureAdminRole } = require('../../middlewares/auth');

// GET /api/admin/payments
const listPayments = async (req, res) => {
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
};

module.exports = { listPayments };
