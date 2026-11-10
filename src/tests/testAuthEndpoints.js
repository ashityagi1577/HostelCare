const UserModel = require('../models/user.model');
const { hashPassword } = require('../utils/password.util');
const { generateToken, verifyToken } = require('../utils/jwt.util');
const { pool } = require('../config/db');

// We test the controller functions directly with mock req and res objects
// to verify all API contracts, status codes, validations, and responses
const authController = require('../controllers/auth.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth.middleware');

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runAuthTests() {
  console.log('\n=============================================');
  console.log('   🧪 HostelCare Auth REST API Test Suite');
  console.log('=============================================\n');

  const testEmail = `student_${Date.now()}@hostelcare.test`;
  const testPassword = 'StudentPass@123';
  let createdUserId = null;
  let userToken = null;

  try {
    // Test 1: Student Registration (Valid)
    console.log('[1/7] Testing POST /api/auth/register (New Student)...');
    const regReq = {
      body: {
        name: 'Priya Sharma',
        email: testEmail,
        password: testPassword,
        hostel_block: 'Block C (Girls)',
        room_no: 'C-204',
        phone: '9876543210'
      }
    };
    const regRes = createMockRes();
    await authController.register(regReq, regRes);

    if (regRes.statusCode !== 201 || !regRes.body.success) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }
    createdUserId = regRes.body.data.user.id;
    console.log(`      ✔ HTTP 201 Created: User ID ${createdUserId}, Token issued.`);

    // Test 2: Duplicate Registration Prevention
    console.log('\n[2/7] Testing Duplicate Email Prevention...');
    const dupRes = createMockRes();
    await authController.register(regReq, dupRes);
    if (dupRes.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict, received ${dupRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 409 Conflict: "${dupRes.body.error}"`);

    // Test 3: Login with Valid Credentials
    console.log('\n[3/7] Testing POST /api/auth/login (Correct Credentials)...');
    const loginReq = {
      body: {
        email: testEmail,
        password: testPassword
      }
    };
    const loginRes = createMockRes();
    await authController.login(loginReq, loginRes);

    if (loginRes.statusCode !== 200 || !loginRes.body.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    userToken = loginRes.body.data.token;
    console.log(`      ✔ HTTP 200 OK: ${loginRes.body.message}`);

    // Test 4: Login with Invalid Password
    console.log('\n[4/7] Testing POST /api/auth/login (Invalid Password)...');
    const badLoginReq = {
      body: {
        email: testEmail,
        password: 'IncorrectPassword999'
      }
    };
    const badLoginRes = createMockRes();
    await authController.login(badLoginReq, badLoginRes);

    if (badLoginRes.statusCode !== 401) {
      throw new Error(`Expected 401 Unauthorized, received ${badLoginRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 401 Unauthorized: "${badLoginRes.body.error}"`);

    // Test 5: Protected Route GET /api/auth/me (With Valid Token)
    console.log('\n[5/7] Testing GET /api/auth/me (Protected with Token)...');
    const authHeaderReq = {
      headers: { authorization: `Bearer ${userToken}` }
    };
    const authMiddlewareRes = createMockRes();
    let authNextCalled = false;
    authenticateToken(authHeaderReq, authMiddlewareRes, () => {
      authNextCalled = true;
    });

    if (!authNextCalled || !authHeaderReq.user) {
      throw new Error('Authentication middleware failed to verify valid token');
    }

    const meRes = createMockRes();
    await authController.getProfile(authHeaderReq, meRes);
    if (meRes.statusCode !== 200 || !meRes.body.data.user) {
      throw new Error(`Profile retrieval failed: ${JSON.stringify(meRes.body)}`);
    }
    console.log(`      ✔ HTTP 200 OK: Retrieved profile for '${meRes.body.data.user.name}' (${meRes.body.data.user.role})`);

    // Test 6: Protected Route GET /api/auth/me (Without Token)
    console.log('\n[6/7] Testing Protected Route Without Token...');
    const noTokenReq = { headers: {} };
    const noTokenRes = createMockRes();
    authenticateToken(noTokenReq, noTokenRes, () => {});
    if (noTokenRes.statusCode !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${noTokenRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 401 Unauthorized: "${noTokenRes.body.error}"`);

    // Test 7: Role Guard Restriction (Student attempting Staff-Only access)
    console.log('\n[7/7] Testing Role Guard (Student blocked from Staff endpoint)...');
    const staffGuard = requireRoles('staff', 'admin');
    const guardReq = { user: { role: 'student' } };
    const guardRes = createMockRes();
    let guardNextCalled = false;
    staffGuard(guardReq, guardRes, () => { guardNextCalled = true; });

    if (guardNextCalled || guardRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for Student on Staff route, got ${guardRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 403 Forbidden: "${guardRes.body.error}"`);

    // Cleanup
    if (createdUserId) {
      await UserModel.deleteById(createdUserId);
      console.log('\n✔ Test cleanup completed.');
    }

    console.log('\n---------------------------------------------');
    console.log('  🎉 All 7 Phase 5 Auth API tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Auth Test Failed:', error.message);
    if (createdUserId) {
      await UserModel.deleteById(createdUserId).catch(() => {});
    }
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runAuthTests().then((success) => process.exit(success ? 0 : 1));
}

module.exports = runAuthTests;

