const { Pool } = require('pg');
require('dotenv').config();

const dbUser = String(process.env.DB_USER || '').trim();
const dbHost = String(process.env.DB_HOST || 'localhost').trim();
const dbName = String(process.env.DB_NAME || '').trim();
const dbPassword = String(process.env.DB_PASSWORD || '').trim();
const dbPort = Number(process.env.DB_PORT || 5440);

if (!dbUser || !dbName || !dbPassword) {
  throw new Error('Thiếu DB_USER, DB_NAME hoặc DB_PASSWORD trong .env');
}

const pool = new Pool({
  user: dbUser,
  host: dbHost,
  database: dbName,
  password: dbPassword,
  port: dbPort,
  client_encoding: 'UTF8',
});

// Hàm tiện ích để log khi kết nối thành công/thất bại
pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(), // Dùng cho Transaction
};