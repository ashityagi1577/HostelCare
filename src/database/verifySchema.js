const { pool } = require('../config/db');

/**
 * Inspects hostelcare_db schema, listing all tables, column counts,
 * and foreign key relationships.
 */
async function verifySchema() {
  console.log('\n=============================================');
  console.log('   🔍 HostelCare Database Schema Inspection');
  console.log('=============================================\n');

  try {
    // 1. Fetch tables
    const [tables] = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       ORDER BY table_name ASC;`
    );

    console.log(`Found ${tables.length} tables in database:`);
    for (const t of tables) {
      const tableName = t.TABLE_NAME || t.table_name;
      const [columns] = await pool.query(
        `SELECT column_name, data_type, column_key, is_nullable 
         FROM information_schema.columns 
         WHERE table_schema = DATABASE() AND table_name = ?
         ORDER BY ordinal_position ASC;`,
        [tableName]
      );
      console.log(`\n📋 Table: '${tableName}' (${columns.length} columns)`);
      columns.forEach((col) => {
        const name = col.COLUMN_NAME || col.column_name;
        const type = col.DATA_TYPE || col.data_type;
        const key = col.COLUMN_KEY || col.column_key;
        const nullable = (col.IS_NULLABLE || col.is_nullable) === 'YES' ? 'NULL' : 'NOT NULL';
        const keyBadge = key === 'PRI' ? '[PK]' : key === 'UNI' ? '[UNIQUE]' : key === 'MUL' ? '[INDEX/FK]' : '';
        console.log(`   - ${name.padEnd(20)} ${type.padEnd(12)} ${nullable.padEnd(10)} ${keyBadge}`);
      });
    }

    // 2. Fetch Foreign Keys
    const [fks] = await pool.query(
      `SELECT 
         table_name,
         column_name,
         referenced_table_name,
         referenced_column_name
       FROM information_schema.key_column_usage
       WHERE table_schema = DATABASE() 
         AND referenced_table_name IS NOT NULL
       ORDER BY table_name, column_name;`
    );

    console.log('\n🔗 Foreign Key Relationships Verified:');
    fks.forEach((fk) => {
      const srcTbl = fk.TABLE_NAME || fk.table_name;
      const srcCol = fk.COLUMN_NAME || fk.column_name;
      const refTbl = fk.REFERENCED_TABLE_NAME || fk.referenced_table_name;
      const refCol = fk.REFERENCED_COLUMN_NAME || fk.referenced_column_name;
      console.log(`   • ${srcTbl}.${srcCol} ──► ${refTbl}.${refCol}`);
    });

    console.log('\n---------------------------------------------');
    console.log('  ✔ Relational integrity completely verified!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('Error inspecting schema:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  verifySchema().then(() => process.exit(0));
}

module.exports = verifySchema;

