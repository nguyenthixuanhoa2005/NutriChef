'use strict';

const fs = require('fs');
const db = require('../config/db');

// POST /api/webhooks/sepay
const sepayWebhook = async (req, res) => {
    const logData = `
--- ${new Date().toLocaleString()} ---
Headers: ${JSON.stringify(req.headers, null, 2)}
Body: ${JSON.stringify(req.body, null, 2)}
---------------------------
`;
    fs.appendFileSync('sepay_webhook.log', logData);

    console.log('--- 📩 Nhận Webhook SePay ---');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('---------------------------');

    const {
        content,
        transferAmount,
        amount,
        id,
        referenceCode,
        transactionDate,
        transfer_date,
        transaction_id
    } = req.body || {};

    // Support field names từ SePay
    const paymentAmount = transferAmount || amount;
    const txId = referenceCode || id || transaction_id;
    const txDate = transactionDate || transfer_date;

    if (!content) {
        return res.json({ status: 'ignored', message: 'No content found' });
    }

    // 1. Tìm giao dịch PENDING hoặc đang xử lý
    // Tìm kiếm: internal_reference match hoặc content chứa internal_reference
    const paymentResult = await db.query(
        "SELECT * FROM payment WHERE (internal_reference = $1 OR internal_reference ILIKE '%' || $1 || '%' OR $1 ILIKE '%' || internal_reference || '%') ORDER BY create_at DESC LIMIT 1",
        [content.trim()]
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
        console.warn(`⚠️ Không tìm thấy giao dịch khớp với nội dung: ${content}`);
        return res.json({ status: 'ignored', message: 'No matching payment' });
    }

    console.log(`✅ Tìm thấy payment ID: ${payment.payment_id}, Status: ${payment.status}, Ref: ${payment.internal_reference}`);

    // Nếu đã xử lý rồi thì bỏ qua
    if (payment.status === 'SUCCESS') {
        console.log(`ℹ️ Payment đã xử lý thành công trước đó`);
        return res.json({ status: 'already_processed', message: 'Payment already successful' });
    }

    // 2. Kiểm tra số tiền (Cho phép sai số nhỏ dưới 100đ)
    const diff = Math.abs(parseFloat(paymentAmount) - parseFloat(payment.amount));
    if (diff > 100) {
        console.warn(`⚠️ Số tiền không khớp. SePay: ${paymentAmount}, DB: ${payment.amount}`);
        return res.json({ status: 'error', message: 'Amount mismatch' });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 3. Cập nhật trạng thái giao dịch
        await client.query(
            `UPDATE payment
             SET status = 'SUCCESS',
                 transaction_code = $1,
                 paid_at = $2
             WHERE payment_id = $3`,
            [txId || `SEPAY_${Date.now()}`, txDate || new Date(), payment.payment_id]
        );

        // 4. Lấy thông tin gói
        const planResult = await client.query('SELECT duration_days FROM premium_plan WHERE plan_id = $1', [payment.plan_id]);
        const durationDays = planResult.rows[0]?.duration_days || 30;

        // 5. Thêm vào lịch sử Premium
        await client.query(
            `INSERT INTO user_premium_history (user_id, plan_id, payment_id, start_date, end_date)
             VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval)
             ON CONFLICT (payment_id) DO NOTHING`,
            [payment.user_id, payment.plan_id, payment.payment_id, durationDays]
        );

        // 6. Gán Role PREMIUM_USER
        await client.query(
            `INSERT INTO user_role (user_id, role_id)
             SELECT $1, role_id FROM role WHERE role_name = 'PREMIUM_USER'
             ON CONFLICT DO NOTHING`,
            [payment.user_id]
        );

        await client.query('COMMIT');
        console.log(`✅ Nâng cấp thành công cho User ID: ${payment.user_id}`);
        res.json({ status: 'success', message: 'Payment processed successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Lỗi xử lý Webhook SePay:', error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    } finally {
        client.release();
    }
};

module.exports = { sepayWebhook };
