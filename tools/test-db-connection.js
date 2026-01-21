// Simple DB connection test for mysql2
require('dotenv').config();
const mysql = require('mysql2');

const {
  DB_HOST = process.env.DB_HOST,
  DB_USER = process.env.DB_USER,
  DB_NAME = process.env.DB_NAME,
  DB_PORT = process.env.DB_PORT || 3306,
} = process.env;

const DB_PASS = process.env.DB_PASS || process.env.DB_PASSWORD;

if (!DB_HOST || !DB_USER || !DB_PASS) {
  console.error('Missing DB env vars. Please set DB_HOST, DB_USER and DB_PASS (or DB_PASSWORD).');
  process.exit(1);
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
});

console.log('Attempting connection to', DB_HOST + ':' + DB_PORT, 'database:', DB_NAME);

pool.getConnection((err, conn) => {
  if (err) {
    console.error('Connection error:');
    console.error('  code:', err.code);
    console.error('  errno:', err.errno);
    console.error('  syscall:', err.syscall);
    console.error('  message:', err.message);
    console.error('Full error object:', err);
    process.exit(2);
  }

  console.log('Connected. Running simple query...');
  conn.query('SELECT 1 AS ok', (qErr, results) => {
    if (qErr) {
      console.error('Query error:', qErr);
      conn.release();
      process.exit(3);
    }
    console.log('Query result:', results);
    conn.release();
    process.exit(0);
  });
});
