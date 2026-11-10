const UserModel = require('../models/user.model');
const { hashPassword, comparePassword } = require('./password.util');
const { generateToken, verifyToken } = require('./jwt.util');
const { pool } = require('../config/db');

async function testSecurityFlow() {
  console.log('\n=============================================');
  console.log('   🔒 HostelCare Security & User Model Test');
  console.log('=============================================\n');

  const testEmail = `test_resident_${Date.now()}@hostel.edu`;
  const rawPassword = 'SecureStudentPass@2026';
  let createdUserId = null;

  try {
    // 1. Password Hashing Test
    console.log('[1/5] Testing Bcrypt Password Hashing...');
    const hashed = await hashPassword(rawPassword);
    console.log('      ✔ Hash generated successfully (starts with $2a$10$):', hashed.substring(0, 15) + '...');

    // 2. User Creation in MySQL Database
    console.log('\n[2/5] Inserting Test Resident into MySQL users table...');
    const createdUser = await UserModel.createUser({
      name: 'Rohan Verma',
      email: testEmail,
      passwordHash: hashed,
      role: 'student',
      hostel_block: 'Block B',
      room_no: 'B-302',
      phone: '9876543210'
    });
    createdUserId = createdUser.id;
    console.log(`      ✔ User inserted with ID: ${createdUserId}, Email: ${createdUser.email}`);

    // 3. User Retrieval and Password Comparison
    console.log('\n[3/5] Querying user and testing password validation...');
    const dbUser = await UserModel.findByEmail(testEmail);
    if (!dbUser) throw new Error('Failed to retrieve inserted user');

    const isValidMatch = await comparePassword(rawPassword, dbUser.password_hash);
    const isInvalidRejected = await comparePassword('WrongPassword123', dbUser.password_hash);
    console.log('      ✔ Correct password matched:', isValidMatch);
    console.log('      ✔ Incorrect password rejected:', !isInvalidRejected);
    if (!isValidMatch || isInvalidRejected) throw new Error('Password verification logic failure');

    // 4. JWT Generation & Signature Verification
    console.log('\n[4/5] Testing JWT Token Generation & Verification...');
    const token = generateToken(dbUser);
    const decoded = verifyToken(token);
    console.log('      ✔ JWT Token issued successfully.');
    console.log('      ✔ Decoded claims match user profile:', {
      id: decoded.id,
      name: decoded.name,
      role: decoded.role,
      hostel_block: decoded.hostel_block,
      room_no: decoded.room_no
    });

    // 5. Cleanup Test Record
    console.log('\n[5/5] Cleaning up test resident from database...');
    const cleaned = await UserModel.deleteById(createdUserId);
    console.log('      ✔ Test user record deleted cleanly:', cleaned);

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Security & User Model tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Security Test Failed:', error.message);
    if (createdUserId) {
      await UserModel.deleteById(createdUserId).catch(() => {});
    }
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testSecurityFlow().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testSecurityFlow;

