const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const StaffController = require('../controllers/staff.controller');
const { pool } = require('../config/db');

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

async function testStaffAPIs() {
  console.log('\n=============================================');
  console.log('   🛠️ HostelCare Staff Triage & Filter APIs');
  console.log('=============================================\n');

  let studentId = null;
  let staffId = null;
  const createdComplaintIds = [];

  try {
    // 1. Setup Accounts
    console.log('[1/6] Creating test student and staff accounts...');
    const student = await UserModel.createUser({
      name: 'Varun Joshi',
      email: `varun_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block B',
      room_no: 'B-112',
      phone: '9811223344'
    });
    studentId = student.id;

    const staff = await UserModel.createUser({
      name: 'Warden Mukherjee',
      email: `mukherjee_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'staff',
      phone: '9811223355'
    });
    staffId = staff.id;
    console.log(`      ✔ Student #${studentId} and Staff #${staffId} created.`);

    // 2. Seed 3 diverse complaints
    console.log('\n[2/6] Seeding 3 diverse complaints with varying priority & category...');
    const c1 = await ComplaintModel.createComplaint({
      student_id: studentId,
      category: 'Plumbing',
      title: 'Water Pipe Burst in Corridor',
      description: 'Severe flooding near room B-112.',
      priority: 'Emergency'
    });
    createdComplaintIds.push(c1.id);

    const c2 = await ComplaintModel.createComplaint({
      student_id: studentId,
      category: 'Electrical',
      title: 'Tube Light Flickering',
      description: 'Room tube light won\'t stay steady.',
      priority: 'Low'
    });
    createdComplaintIds.push(c2.id);

    const c3 = await ComplaintModel.createComplaint({
      student_id: studentId,
      category: 'Cleaning',
      title: 'Common Washroom Needs Cleaning',
      description: 'Trash can overflowing and floors wet.',
      priority: 'Medium'
    });
    createdComplaintIds.push(c3.id);
    console.log(`      ✔ Seeded 3 tickets: ${c1.ticket_no} (Emergency), ${c2.ticket_no} (Low), ${c3.ticket_no} (Medium)`);

    // 3. Test Staff Query (All Complaints with Priority Sorting)
    console.log('\n[3/6] Testing GET /api/staff/complaints (Priority Ordering)...');
    const allReq = {
      user: { id: staffId, role: 'staff' },
      query: {}
    };
    const allRes = createMockRes();
    await StaffController.getAllComplaints(allReq, allRes);

    if (allRes.statusCode !== 200 || allRes.body.data.length < 3) {
      throw new Error(`Expected at least 3 complaints, got ${allRes.body.data.length}`);
    }
    // First complaint must be Emergency
    if (allRes.body.data[0].priority !== 'Emergency') {
      throw new Error(`Expected first complaint to be Emergency, found: ${allRes.body.data[0].priority}`);
    }
    console.log(`      ✔ HTTP 200 OK: ${allRes.body.data.length} complaints returned.`);
    console.log(`      ✔ Correct Priority Order: 1st is [${allRes.body.data[0].priority}] - "${allRes.body.data[0].title}"`);

    // 4. Test Multi-Criteria Filters
    console.log('\n[4/6] Testing Query Filters (category, priority, search)...');

    // Filter by category: Electrical
    const catReq = { user: { id: staffId, role: 'staff' }, query: { category: 'Electrical' } };
    const catRes = createMockRes();
    await StaffController.getAllComplaints(catReq, catRes);
    const allElectrical = catRes.body.data.every(c => c.category === 'Electrical');
    if (!allElectrical || catRes.body.data.length === 0) throw new Error('Category filter failed');
    console.log(`      ✔ Filter category=Electrical: matched ${catRes.body.data.length} ticket(s)`);

    // Filter by priority: Emergency
    const emReq = { user: { id: staffId, role: 'staff' }, query: { priority: 'Emergency' } };
    const emRes = createMockRes();
    await StaffController.getAllComplaints(emReq, emRes);
    const allEmergency = emRes.body.data.every(c => c.priority === 'Emergency');
    if (!allEmergency || emRes.body.data.length === 0) throw new Error('Priority filter failed');
    console.log(`      ✔ Filter priority=Emergency: matched ${emRes.body.data.length} ticket(s)`);

    // Search by room: B-112
    const searchReq = { user: { id: staffId, role: 'staff' }, query: { search: 'B-112' } };
    const searchRes = createMockRes();
    await StaffController.getAllComplaints(searchReq, searchRes);
    if (searchRes.body.data.length < 3) throw new Error('Search by room number failed');
    console.log(`      ✔ Search search=B-112: matched ${searchRes.body.data.length} ticket(s)`);

    // 5. Test Status Update via Staff API
    console.log('\n[5/6] Testing PATCH /api/staff/complaints/:id/status...');
    const statusReq = {
      user: { id: staffId, name: 'Warden Mukherjee', role: 'staff' },
      params: { id: c1.id },
      body: {
        status: 'In_Progress',
        action: 'Plumber Dispatched',
        remarks: 'Emergency plumber Dinesh dispatched with tools and pipe sealants.'
      }
    };
    const statusRes = createMockRes();
    await StaffController.updateStatus(statusReq, statusRes);

    if (statusRes.statusCode !== 200 || statusRes.body.data.status !== 'In_Progress') {
      throw new Error(`Failed to update status: ${JSON.stringify(statusRes.body)}`);
    }
    console.log(`      ✔ HTTP 200 OK: ${statusRes.body.message}`);

    // Verify audit log entry was written
    const logs = await ComplaintModel.getTimeline(c1.id);
    const latestLog = logs[logs.length - 1];
    console.log(`      ✔ Audit Log Recorded: [${latestLog.action}] remarks: "${latestLog.remarks}"`);

    // 6. Test Single Detail View with Timeline
    console.log('\n[6/6] Testing GET /api/staff/complaints/:id (with Stepper)...');
    const detailReq = {
      user: { id: staffId, role: 'staff' },
      params: { id: c1.id }
    };
    const detailRes = createMockRes();
    await StaffController.getComplaintById(detailReq, detailRes);

    if (detailRes.statusCode !== 200 || !detailRes.body.data.timeline) {
      throw new Error('Failed to retrieve full detail with stepper');
    }
    console.log(`      ✔ HTTP 200 OK: Retrieved #${c1.id} with ${detailRes.body.data.timeline.stepper.length} stepper nodes`);

    // Cleanup
    for (const id of createdComplaintIds) {
      await ComplaintModel.deleteById(id);
    }
    if (studentId) await UserModel.deleteById(studentId);
    if (staffId) await UserModel.deleteById(staffId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 10 Staff Triage API tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Staff API Test Failed:', error.message);
    for (const id of createdComplaintIds) {
      await ComplaintModel.deleteById(id).catch(() => {});
    }
    if (studentId) await UserModel.deleteById(studentId).catch(() => {});
    if (staffId) await UserModel.deleteById(staffId).catch(() => {});
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testStaffAPIs().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testStaffAPIs;

