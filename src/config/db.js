const mysql = require('mysql2/promise');
const dbConfig = require('./db.config');

/**
 * HostelCare MySQL Connection Pool
 * Using mysql2/promise for async/await database operations.
 */
const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: dbConfig.waitForConnections,
  connectionLimit: dbConfig.connectionLimit,
  queueLimit: dbConfig.queueLimit,
  enableKeepAlive: dbConfig.enableKeepAlive,
  keepAliveInitialDelay: dbConfig.keepAliveInitialDelay
});

/**
 * Helper function to execute parameterized SQL queries
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Array of parameters to bind
 * @returns {Promise<[any, any]>} - Result rows and fields
 */
async function query(sql, params = []) {
  try {
    const [rows, fields] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`[Database Query Error] SQL: ${sql}`, error.message);
    throw error;
  }
}

/**
 * Helper function to execute statements (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query string
 * @param {Array} params - Parameters
 * @returns {Promise<any>} - ResultSetHeader containing insertId, affectedRows, etc.
 */
async function execute(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return result;
  } catch (error) {
    console.error(`[Database Execute Error] SQL: ${sql}`, error.message);
    throw error;
  }
}

module.exports = {
  pool,
  query,
  execute
};

