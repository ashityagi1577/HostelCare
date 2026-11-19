const { pool } = require('../config/db');

async function runMigration() {
  console.log('--- Running Technician Schema Migration ---');
  try {
    // 1. Modify users.role enum to include 'technician'
    console.log('1. Updating users.role ENUM...');
    await pool.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('student', 'staff', 'admin', 'technician') NOT NULL DEFAULT 'student';
    `);
    console.log('   ✔ users.role updated successfully.');

    // 2. Check if tech_id column exists
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'tech_id';
    `);

    if (cols.length === 0) {
      console.log('2. Adding tech_id column to users table...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN tech_id INT NULL AFTER role,
        ADD INDEX idx_user_tech_id (tech_id);
      `);
      console.log('   ✔ tech_id column added.');
    } else {
      console.log('2. tech_id column already exists.');
    }

    console.log('--- Migration Finished Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
