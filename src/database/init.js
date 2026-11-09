const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dbConfig = require('../config/db.config');
const { pool } = require('../config/db');

/**
 * Initializes the HostelCare MySQL database schema
 * Reads schema.sql and creates all tables, foreign keys, and indexes.
 */
async function initDatabase() {
  console.log('\n=============================================');
  console.log('   🚀 HostelCare Database Schema Migration');
  console.log('=============================================\n');

  try {
    // 1. Ensure the database itself exists
    console.log(`Connecting to MySQL to verify database '${dbConfig.database}'...`);
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();
    console.log(`✔ Database '${dbConfig.database}' is ready.`);

    // 2. Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // 3. Clean comments and extract distinct statements
    const cleanedSql = schemaSql
      .replace(/--.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments

    // Split on semicolon, trim whitespace and filter empty statements
    const statements = cleanedSql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    console.log(`\nExecuting ${statements.length} table migration statements in relational order...\n`);

    // 4. Execute each statement sequentially
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      // Extract table name from CREATE TABLE IF NOT EXISTS <table_name>
      const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`\w]+)/i);
      const tableName = match ? match[1].replace(/`/g, '') : `statement_${i + 1}`;

      await pool.query(stmt);
      console.log(`   [${i + 1}/${statements.length}] ✔ Table '${tableName}' verified/created successfully.`);
    }

    console.log('\n---------------------------------------------');
    console.log('  🎉 All 5 database tables migrated successfully!');
    console.log('  Tables: users, technicians, complaints,');
    console.log('          complaint_logs, feedback');
    console.log('---------------------------------------------\n');
    return true;
  } catch (error) {
    console.error('\n❌ Migration Failed:');
    console.error(`   Message: ${error.message}`);
    if (error.sql) {
      console.error(`   Failing SQL: ${error.sql}`);
    }
    console.log('=============================================\n');
    return false;
  }
}

// Execute if run directly from CLI
if (require.main === module) {
  initDatabase().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = initDatabase;

