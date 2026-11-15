const assert = require('assert');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt.util');
const { hashPassword } = require('../utils/password.util');

const BASE_URL = 'http://localhost:3000';

async function runE2ETest() {
  console.log('\n======================================================');
  console.log('   🚀 HostelCare End-to-End Complete Flow Verification');
  console.log('======================================================\n');

  try {
    const defaultPassword = 'password123';
    const passwordHash = await hashPassword(defaultPassword);

    // 1. Setup fresh test student & staff accounts
    console.log('[Step 1/11] Setting up E2E student and staff accounts...');
    const testStudentEmail = `e2e_student_${Date.now()}@test.com`;
    const testStaffEmail = `e2e_staff_${Date.now()}@test.com`;

    const [studentResult] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, hostel_block, room_no, phone)
       VALUES ('E2E Tester', ?, ?, 'student', 'Block A (Boys)', 'A-101', '9876500000');`,
      [testStudentEmail, passwordHash]
    );
    const studentId = studentResult.insertId;

    const [staffResult] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ('E2E Warden', ?, ?, 'staff', '9876511111');`,
      [testStaffEmail, passwordHash]
    );
    const staffId = staffResult.insertId;

    // Tokens
    const studentToken = generateToken({ id: studentId, name: 'E2E Tester', email: testStudentEmail, role: 'student' });
    const staffToken = generateToken({ id: staffId, name: 'E2E Warden', email: testStaffEmail, role: 'staff' });
    console.log(`      ✔ Accounts created: Student #${studentId}, Staff #${staffId}`);

    // 2. Student lodges a complaint
    console.log('\n[Step 2/11] Student lodges maintenance complaint via POST /api/complaints...');
    const lodgeRes = await fetch(`${BASE_URL}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        category: 'Electrical',
        title: 'Ceiling Fan grinding noise and overheating',
        description: 'Room A-101 ceiling fan is overheating and emitting a burning smell at speed 4.',
        priority: 'High'
      })
    });
    const lodgeData = await lodgeRes.json();
    assert.strictEqual(lodgeRes.status, 201, 'Lodge complaint status should be 201');
    assert.strictEqual(lodgeData.success, true);
    const ticketNo = lodgeData.data.ticket_no;
    const complaintId = lodgeData.data.id;
    console.log(`      ✔ Ticket successfully lodged: ${ticketNo} (ID: ${complaintId}), Status: ${lodgeData.data.status}`);

    // 3. Student views their complaint queue
    console.log('\n[Step 3/11] Student checks their complaints via GET /api/complaints/my...');
    const myRes = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    const myData = await myRes.json();
    assert.strictEqual(myRes.status, 200);
    assert.ok(myData.data.some(c => c.ticket_no === ticketNo), 'Lodged ticket must appear in student queue');
    console.log(`      ✔ Verified ticket ${ticketNo} in student dashboard queue`);

    // 4. Public Guest tracks the ticket (No auth required)
    console.log('\n[Step 4/11] Guest tracks ticket progress via GET /api/complaints/:ticketNo...');
    const trackRes = await fetch(`${BASE_URL}/api/complaints/${ticketNo}`);
    const trackData = await trackRes.json();
    assert.strictEqual(trackRes.status, 200, 'Public tracking must not require token');
    assert.strictEqual(trackData.data.ticket_no, ticketNo);
    console.log(`      ✔ Public tracking accessible without token! Status: ${trackData.data.status}`);

    // 5. Stepper timeline check
    console.log('\n[Step 5/11] Public tracks 5-stage stepper via GET /api/complaints/:ticketNo/timeline...');
    const timeRes = await fetch(`${BASE_URL}/api/complaints/${ticketNo}/timeline`);
    const timeData = await timeRes.json();
    assert.strictEqual(timeRes.status, 200);
    assert.strictEqual(timeData.data.stepper.length, 5, 'Must have 5 visual stepper stages');
    assert.strictEqual(timeData.data.stepper[0].state, 'current', 'Stage 1 must be current');
    console.log(`      ✔ Stepper verified: 5 stages intact, Step 1 is CURRENT`);

    // 6. Staff views triage queue
    console.log('\n[Step 6/11] Staff views triage queue via GET /api/staff/complaints...');
    const staffQueueRes = await fetch(`${BASE_URL}/api/staff/complaints?search=${ticketNo}`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const staffQueueData = await staffQueueRes.json();
    assert.strictEqual(staffQueueRes.status, 200);
    assert.ok(staffQueueData.data.length >= 1, 'Staff search must locate ticket');
    console.log(`      ✔ Staff successfully found ticket in triage queue`);

    // 7. Staff assigns technician
    console.log('\n[Step 7/11] Staff allocates technician via PATCH /api/staff/complaints/:id/assign...');
    // Fetch an electrical technician
    const [techRows] = await pool.query("SELECT id FROM technicians WHERE trade = 'Electrical' LIMIT 1;");
    const techId = techRows[0].id;

    const assignRes = await fetch(`${BASE_URL}/api/staff/complaints/${complaintId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        technician_id: techId,
        estimated_date: '2026-11-20',
        remarks: 'Assigned Ramesh Patel. Bring replacement capacitor.'
      })
    });
    const assignData = await assignRes.json();
    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(assignData.data.status, 'Assigned');
    console.log(`      ✔ Assigned to Tech #${techId}, Status transitioned to 'Assigned'`);

    // 8. Staff marks In Progress
    console.log('\n[Step 8/11] Staff updates status to In Progress via PATCH /api/staff/complaints/:id/status...');
    const progressRes = await fetch(`${BASE_URL}/api/staff/complaints/${complaintId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        status: 'In_Progress',
        remarks: 'Technician on-site dismantling fan assembly'
      })
    });
    const progressData = await progressRes.json();
    assert.strictEqual(progressRes.status, 200);
    assert.strictEqual(progressData.data.status, 'In_Progress');
    console.log(`      ✔ Status transitioned to 'In_Progress'`);

    // 9. Staff marks Resolved
    console.log('\n[Step 9/11] Staff marks ticket Resolved via PATCH /api/staff/complaints/:id/resolve...');
    const resolveRes = await fetch(`${BASE_URL}/api/staff/complaints/${complaintId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        resolution_notes: 'Replaced 2.5uF capacitor and oiled rotor bearings. Tested smooth rotation.'
      })
    });
    const resolveData = await resolveRes.json();
    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(resolveData.data.status, 'Resolved');
    console.log(`      ✔ Status transitioned to 'Resolved', resolution notes recorded`);

    // 10. Student submits 5-star rating & feedback -> automatically transitions to Closed
    console.log('\n[Step 10/11] Student submits 5-star rating via POST /api/complaints/:id/feedback...');
    const feedbackRes = await fetch(`${BASE_URL}/api/complaints/${complaintId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        rating: 5,
        comments: 'Extremely quick service! Fan is silent and runs at full speed now.'
      })
    });
    const feedbackData = await feedbackRes.json();
    assert.strictEqual(feedbackRes.status, 201);
    assert.strictEqual(feedbackData.data.rating, 5);

    // Verify status is now Closed
    const [finalRow] = await pool.query('SELECT status FROM complaints WHERE id = ?;', [complaintId]);
    assert.strictEqual(finalRow[0].status, 'Closed', 'Ticket must be auto-closed after feedback');
    console.log(`      ✔ 5-star rating recorded! Ticket status automatically advanced to 'Closed'`);

    // 11. Staff checks CSV export and Analytics Dashboard
    console.log('\n[Step 11/11] Verifying Staff CSV Export and Analytics Dashboard...');
    const csvRes = await fetch(`${BASE_URL}/api/staff/complaints/export`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert.strictEqual(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes(ticketNo), 'CSV export must include the completed ticket');
    assert.ok(csvText.includes('Closed'), 'CSV export must reflect Closed status');
    console.log(`      ✔ CSV export verified! Downloaded ${csvText.length} bytes`);

    const analyticsRes = await fetch(`${BASE_URL}/api/analytics/dashboard`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const analyticsData = await analyticsRes.json();
    assert.strictEqual(analyticsRes.status, 200);
    assert.ok(analyticsData.data.satisfaction.total_reviews >= 1);
    console.log(`      ✔ Analytics KPI verified: Avg Rating = ${analyticsData.data.satisfaction.average_rating}/5.0`);

    // Cleanup
    await pool.execute('DELETE FROM feedback WHERE complaint_id = ?;', [complaintId]);
    await pool.execute('DELETE FROM complaint_logs WHERE complaint_id = ?;', [complaintId]);
    await pool.execute('DELETE FROM complaints WHERE id = ?;', [complaintId]);
    await pool.execute('DELETE FROM users WHERE id IN (?, ?);', [studentId, staffId]);

    console.log('\n------------------------------------------------------');
    console.log('  🎉 COMPLETE END-TO-END SYSTEM FLOW TEST PASSED! 🚀');
    console.log('======================================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ E2E Flow Test Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runE2ETest().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = runE2ETest;

