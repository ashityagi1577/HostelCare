const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dbConfig = require('../config/db.config');
const { pool } = require('../config/db');

/**
 * Automatically creates the database if it doesn't exist
 * and verifies pool connectivity.
 */
async function testConnection() {
  console.log('\n=============================================');
  console.log('   🔍 HostelCare MySQL Connection Check');
  console.log('=============================================\n');

  console.log(`Connecting to MySQL server at ${dbConfig.host}:${dbConfig.port} as user '${dbConfig.user}'...`);

  let rootConnection;
  try {
    // 1. Connect without selecting database to verify credentials & create DB if missing
    rootConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    console.log('✔ Successfully reached MySQL server.');

    // 2. Ensure database exists
    const createDbQuery = `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;
    await rootConnection.query(createDbQuery);
    console.log(`✔ Database '${dbConfig.database}' checked / created successfully.`);

    await rootConnection.end();

    // 3. Test the application connection pool
    console.log(`\nTesting connection pool targeting '${dbConfig.database}'...`);
    const [rows] = await pool.query('SELECT 1 + 1 AS math_test, NOW() AS server_time, VERSION() AS mysql_version');
    
    console.log('✔ Connection pool test PASSED!\n');
    console.log('---------------------------------------------');
    console.log(`  MySQL Version : ${rows[0].mysql_version}`);
    console.log(`  Database Name : ${dbConfig.database}`);
    console.log(`  Server Time   : ${rows[0].server_time}`);
    console.log(`  Status        : READY FOR SCHEMA CREATION`);
    console.log('---------------------------------------------\n');
    return true;
  } catch (error) {
    console.error('\n❌ MySQL Connection Failed:');
    console.error(`   Error Code: ${error.code || 'UNKNOWN'}`);
    console.error(`   Message   : ${error.message}\n`);

    console.log('💡 Diagnostic & Troubleshooting Tips:');
    if (error.code === 'ECONNREFUSED') {
      console.log('   • The MySQL service does not appear to be running.');
      console.log('   • Start MySQL Server via Windows Services (services.msc) or XAMPP / MySQL Workbench.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log(`   • Authentication failed for user '${dbConfig.user}'.`);
      console.log('   • Open your `.env` file and set the correct `DB_PASSWORD` for your MySQL root account.');
    } else {
      console.log('   • Please verify your DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD values in `.env`.');
    }
    console.log('=============================================\n');
    return false;
  }
}

// Execute if run directly from CLI
if (require.main === module) {
  testConnection().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = testConnection;

