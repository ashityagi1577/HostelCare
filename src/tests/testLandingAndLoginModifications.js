const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : {}
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            rawBody: data
          });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   🧪 Running Tests: Landing & Login Modifications');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`   ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Landing Page HTML Checks
    console.log('1. Checking Landing Page Content & Requirements (index.html)...');
    const indexRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/index.html',
      method: 'GET'
    });

    assert(indexRes.statusCode === 200, 'GET /index.html returns 200 OK');
    const html = indexRes.rawBody || '';

    // Check removed items
    assert(!html.includes('Student Login'), 'Removed "Student Login" button from landing page');
    assert(!html.includes('Register Account'), 'Removed "Register Account" button from landing page');
    assert(!html.includes('Staff & Warden Portal'), 'Removed "Staff & Warden Portal" button from landing page');
    assert(!html.includes('quick-track-box'), 'Removed "Track Ticket" form section from middle of landing page');

    // Check added informative sections
    assert(html.includes('Why HostelCare? Purpose &amp; Vision') || html.includes('Why HostelCare?'), 'Includes About & Purpose section');
    assert(html.includes('How HostelCare Resolves Maintenance'), 'Includes "How It Works" workflow lifecycle section');
    assert(html.includes('Student Lodges Request') && html.includes('Warden Triage &amp; Assign') && html.includes('Technician Field Repair'), 'Explains complaint registration, warden assignment, and technician repair');
    assert(html.includes('Four Dedicated User Roles'), 'Includes 4 User Roles section');
    assert(html.includes('Student Resident') && html.includes('Hostel Warden / Staff') && html.includes('Maintenance Technician') && html.includes('Hostel Administrator'), 'Covers Student, Warden, Technician, and Admin roles');

    // 2. Login Page HTML Checks
    console.log('\n2. Checking Login Page Modifications (login.html)...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/login.html',
      method: 'GET'
    });

    assert(loginRes.statusCode === 200, 'GET /login.html returns 200 OK');
    const loginHtml = loginRes.rawBody || '';

    // Check demo credentials removed
    assert(!loginHtml.includes('Demo Credentials'), 'Completely removed "Demo Credentials" section from login page');
    assert(!loginHtml.includes('password123'), 'Does not display demo password123 anywhere on login page');
    assert(!loginHtml.includes('STU-101'), 'Does not display sample STU-101 on login page');
    assert(!loginHtml.includes('tech.ramesh@hostelcare.com'), 'Does not display technician demo email on login page');
    assert(!loginHtml.includes('Create an Account'), 'Removed public "Create an Account" registration link');

    // Check login form remains simple and functional
    assert(loginHtml.includes('id="identifier"') && loginHtml.includes('id="password"'), 'Keep identifier and password inputs intact');
    assert(loginHtml.includes('togglePasswordVisibility'), 'Keep password visibility toggle');
    assert(loginHtml.includes('handleLogin'), 'Keep authentication submission handler');

    // 3. Navbar Checks
    console.log('\n3. Checking Guest Navigation Bar in auth.js...');
    const authJsRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/js/auth.js',
      method: 'GET'
    });
    const authJs = authJsRes.rawBody || '';
    assert(authJs.includes('/login.html'), 'Navbar links to login.html');
    assert(!authJs.includes('/register.html'), 'Completely removed /register.html from navigation bar');

    // 4. Admin Account Provisioning API Check
    console.log('\n4. Testing Admin Account Registration API (POST /api/admin/users)...');
    // First, login as Admin to get JWT token
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'ADM-101',
      password: 'password123'
    });

    assert(adminLoginRes.statusCode === 200, 'Admin ADM-101 login returns 200');
    const adminToken = adminLoginRes.body.data.token;

    // Test creating a student account as Admin
    const uniqueRand = Math.floor(1000 + Math.random() * 9000);
    const createRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      user_id: `STU-TEST-${uniqueRand}`,
      name: 'Test Resident AdminCreated',
      email: `teststudent.${uniqueRand}@hostelcare.com`,
      password: 'password123',
      role: 'student',
      hostel_block: 'Block A (Boys)',
      room_no: 'A-305',
      phone: '9811223344'
    });

    assert(createRes.statusCode === 201, 'POST /api/admin/users returns 201 Created');
    assert(createRes.body.success === true, 'Admin account creation success is true');
    assert(createRes.body.data.user_id === `STU-TEST-${uniqueRand}`, 'Provisioned account ID matches');

    // Test logging in with newly created student account
    const newStudentLogin = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: `STU-TEST-${uniqueRand}`,
      password: 'password123'
    });

    assert(newStudentLogin.statusCode === 200, 'Newly created user can successfully log in via their ID');
    assert(newStudentLogin.body.data.user.role === 'student', 'Auto-detected role is student');

    // 5. Test Non-Admin cannot access POST /api/admin/users
    const nonAdminRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newStudentLogin.body.data.token}`
      }
    }, {
      name: 'Hacker',
      email: 'hacker@hostelcare.com',
      password: 'password123',
      role: 'admin'
    });

    assert(nonAdminRes.statusCode === 403, 'Non-admin forbidden from creating accounts (403)');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`   🏁 Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
