// server/config/database_new.js
// Simple MySQL connection pool using mysql2. Exports the pool so existing code
// that calls `db.execute(sql, params, callback)` will continue to work.

require('dotenv').config();
const mysql = require('mysql2');

const {
  DB_HOST = 'tidal-db.cvskckq2k2cl.us-east-2.rds.amazonaws.com',
  DB_USER = 'admin',
  DB_NAME = 'your_database_name_here', // <-- set this in your .env
  DB_PORT = 3306,
} = process.env;

// DB password: prefer DB_PASS (new name), but accept DB_PASSWORD for backward compatibility
const DB_PASS = process.env.DB_PASS || process.env.DB_PASSWORD;

if (!DB_PASS) {
  console.warn('Warning: DB_PASS/DB_PASSWORD not set in environment. Set DB_PASS (or DB_PASSWORD) in your .env or environment variables.');
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Attempt a quick connection test so startup logs show immediate connection problems
pool.getConnection((err, connection) => {
  if (err) {
    // Provide more context for common network/auth issues
    console.error('❌ MySQL pool connection test failed:');
    console.error('   host:', DB_HOST, 'port:', DB_PORT, 'user:', DB_USER, 'database:', DB_NAME ? DB_NAME : '(not set)');
    console.error('   Error:', err && err.code ? `${err.code} - ${err.message}` : err);
    // Keep process running; higher-level code should decide whether to exit.
  } else {
    console.log(`✅ MySQL pool connected (host=${DB_HOST}, database=${DB_NAME})`);
    connection.release();
  }
});

module.exports = pool;
