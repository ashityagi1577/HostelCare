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
  console.log('\n======================================================');
  console.log('   🧪 Running Automated Tests: Technician Panel');
  console.log('======================================================\n');

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
    // 1. Static HTML serving
    console.log('1. Checking static HTML asset delivery...');
    const htmlRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/technician-dashboard.html',
      method: 'GET'
    });
    assert(htmlRes.statusCode === 200, 'GET /technician-dashboard.html returns 200 OK');
    assert(htmlRes.rawBody && htmlRes.rawBody.includes('id="viewAssigned"') && htmlRes.rawBody.includes('My Assigned Complaints'), 'HTML includes assigned complaints panel');
    assert(htmlRes.rawBody.includes('id="viewHistory"') && htmlRes.rawBody.includes('Completed Complaints'), 'HTML includes completed complaints panel');

    // 2. Login as Technician with TECH-101
    console.log('\n2. Testing Technician Authentication (TECH-101)...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'TECH-101',
      password: 'password123'
    });

    assert(loginRes.statusCode === 200, 'Technician login with TECH-101 returns 200');
    assert(loginRes.body.success === true, 'Login response success is true');
    assert(loginRes.body.data.user.role === 'technician', 'User role is technician');
    assert(loginRes.body.data.user.tech_id === 3, 'User tech_id is 3 (Ramesh Patel)');
    const techToken = loginRes.body.data.token;
    assert(Boolean(techToken), 'JWT token issued successfully');

    // 3. Login as Student and try to access technician API (Role Guard Check)
    console.log('\n3. Testing Role Authorization Guard (Student blocked from Tech API)...');
    const studentLogin = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: 'STU-101',
      password: 'password123'
    });

    const stuToken = studentLogin.body.data.token;
    const forbiddenRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/technician/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${stuToken}` }
    });

    assert(forbiddenRes.statusCode === 403, 'Student blocked with 403 Forbidden on /api/technician/overview');

    // 4. Technician Dashboard Overview
    console.log('\n4. Testing GET /api/technician/overview...');
    const overviewRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/technician/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });

    assert(overviewRes.statusCode === 200, 'GET /api/technician/overview returns 200 OK');
    assert(overviewRes.body.data.technician.name === 'Ramesh Patel', 'Overview reports technician name Ramesh Patel');
    assert(overviewRes.body.data.stats.total_assigned >= 3, `Overview stats reported total_assigned: ${overviewRes.body.data.stats.total_assigned}`);

    // 5. Technician Complaints Scoping & Isolation
    console.log('\n5. Testing GET /api/technician/complaints (Strict Scoping & Isolation)...');
    const complaintsRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/technician/complaints?status=active',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });

    assert(complaintsRes.statusCode === 200, 'GET /api/technician/complaints returns 200 OK');
    const complaints = complaintsRes.body.data;
    assert(Array.isArray(complaints) && complaints.length > 0, `Returned ${complaints.length} active complaints`);
    
    // Check that every complaint belongs to Electrical (Trade of tech_id: 3)
    const allElectrical = complaints.every(c => c.category === 'Electrical');
    assert(allElectrical, 'All returned complaints belong exclusively to technician trade (Electrical)');

    // 6. Test Single Complaint Details & Timeline Logs
    const targetComplaint = complaints[0];
    console.log(`\n6. Testing GET /api/technician/complaints/${targetComplaint.id} (Dossier & Logs)...`);
    const detailRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/technician/complaints/${targetComplaint.id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });

    assert(detailRes.statusCode === 200, `Details fetched for complaint ID ${targetComplaint.id}`);
    assert(detailRes.body.data.ticket_no === targetComplaint.ticket_no, 'Ticket number matches');
    assert(detailRes.body.data.student_name !== undefined, 'Student name included');
    assert(Array.isArray(detailRes.body.data.logs), 'Timeline audit logs array included');

    // 7. Update Complaint Status & Add Work Remarks
    console.log(`\n7. Testing PUT /api/technician/complaints/${targetComplaint.id}/status (Status Mutation)...`);
    const updateRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/technician/complaints/${targetComplaint.id}/status`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      }
    }, {
      status: 'In_Progress',
      remarks: 'Automated Test: Inspected circuit board and tested terminal voltage.'
    });

    assert(updateRes.statusCode === 200, 'Status updated to In_Progress successfully');
    assert(updateRes.body.data.new_status === 'In_Progress', 'Response confirms new_status is In_Progress');

    const updatedDetailRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/technician/complaints/${targetComplaint.id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    const savedRemark = updatedDetailRes.body.data.logs.some(log =>
      log.remarks === 'Automated Test: Inspected circuit board and tested terminal voltage.'
    );
    assert(savedRemark, 'Work remarks are retained in the complaint audit log');

    // 8. Prevent Technician from Modifying Complaints Belonging to Other Technicians
    console.log('\n8. Testing Anti-Tamper Isolation (Rejecting modifications to foreign complaints)...');
    // Let's find a complaint assigned to Plumbing (tech_id = 4)
    const foreignDetailsRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/technician/complaints/20',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(foreignDetailsRes.statusCode === 404, 'Technician cannot read another technician complaint details');

    const foreignRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/technician/complaints/20/status', // HC-2026-0002 assigned to Plumbing
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      }
    }, {
      status: 'Resolved',
      remarks: 'Attempt unauthorized update'
    });

    assert(foreignRes.statusCode === 404, 'Blocked unauthorized modification of other technician complaint (404 Not Found/Not Authorized)');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`   🏁 Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
