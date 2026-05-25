const db = require('./src/config/db');

async function testConnection() {
  try {
    console.log('Đang kiểm tra kết nối database...');
    const result = await db.query('SELECT NOW()');
    console.log('✓ Kết nối thành công!');
    console.log('Thời gian database:', result.rows[0].now);
    process.exit(0);
  } catch (error) {
    console.error('✗ Lỗi kết nối:', error.message);
    process.exit(1);
  }
}

testConnection();
