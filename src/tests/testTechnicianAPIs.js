const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const { TechnicianModel } = require('../models/technician.model');
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

async function testTechnicianAPIs() {
  console.log('\n=============================================');
  console.log('   👨‍🔧 HostelCare Technician & Assignment Test');
  console.log('=============================================\n');

  let studentId = null;
  let staffId = null;
  let technicianId = null;
  let complaintId = null;

  try {
    // 1. Setup Student and Staff
    console.log('[1/6] Creating student and staff test users...');
    const student = await UserModel.createUser({
      name: 'Nitin Sharma',
      email: `nitin_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block A',
      room_no: 'A-304'
    });
    studentId = student.id;

    const staff = await UserModel.createUser({
      name: 'Supervisor Verma',
      email: `verma_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'staff'
    });
    staffId = staff.id;
    console.log(`      ✔ Student #${studentId} and Staff #${staffId} created.`);

    // 2. Register a new Technician via Staff API
    console.log('\n[2/6] Testing POST /api/staff/technicians (Register Technician)...');
    const techReq = {
      user: { id: staffId, role: 'staff' },
      body: {
        name: 'Ramesh Patel',
        trade: 'Electrical',
        phone: '9822334455',
        is_available: true
      }
    };
    const techRes = createMockRes();
    await StaffController.createTechnician(techReq, techRes);

    if (techRes.statusCode !== 201 || !techRes.body.data.id) {
      throw new Error(`Failed to create technician: ${JSON.stringify(techRes.body)}`);
    }
    technicianId = techRes.body.data.id;
    console.log(`      ✔ HTTP 201 Created: Technician #${technicianId} "${techRes.body.data.name}" (${techRes.body.data.trade})`);

    // 3. Lodge a Complaint
    console.log('\n[3/6] Lodging a pending complaint for task allocation...');
    const complaint = await ComplaintModel.createComplaint({
      student_id: studentId,
      category: 'Electrical',
      title: 'Short Circuit in Wall Socket',
      description: 'Sparking sound whenever phone charger is plugged in.',
      priority: 'High'
    });
    complaintId = complaint.id;
    console.log(`      ✔ Complaint lodged: #${complaintId} (${complaint.ticket_no}), Status: ${complaint.status}`);

    // 4. Test Task Assignment via Staff API
    console.log('\n[4/6] Testing PATCH /api/staff/complaints/:id/assign (Allocate to Ramesh Patel)...');
    const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const assignReq = {
      user: { id: staffId, name: 'Supervisor Verma', role: 'staff' },
      params: { id: complaintId },
      body: {
        technician_id: technicianId,
        estimated_date: targetDate,
        remarks: 'Urgent task assigned to Ramesh Patel. Inspect switchboard insulation.'
      }
    };
    const assignRes = createMockRes();
    await StaffController.assignTechnicianToComplaint(assignReq, assignRes);

    if (assignRes.statusCode !== 200 || assignRes.body.data.status !== 'Assigned') {
      throw new Error(`Assignment failed: ${JSON.stringify(assignRes.body)}`);
    }
    console.log(`      ✔ HTTP 200 OK: ${assignRes.body.message}`);
    console.log(`      ✔ Complaint #${complaintId} assigned_tech_id: ${assignRes.body.data.assigned_tech_id}`);
    console.log(`      ✔ Assigned Tech Name: ${assignRes.body.data.technician_name} (${assignRes.body.data.technician_trade})`);

    // Verify audit log has technician assignment recorded
    const timeline = await ComplaintModel.getTimeline(complaintId);
    const assignLog = timeline.find(l => l.new_status === 'Assigned');
    if (!assignLog) throw new Error('Timeline did not capture assignment event');
    console.log(`      ✔ Timeline captured assignment event: "${assignLog.remarks}"`);

    // 5. Test Directory Query with Workload Metrics
    console.log('\n[5/6] Testing GET /api/staff/technicians (Checking Workload Counter)...');
    const listReq = { user: { id: staffId, role: 'staff' }, query: { trade: 'Electrical' } };
    const listRes = createMockRes();
    await StaffController.getTechnicians(listReq, listRes);

    const ramesh = listRes.body.data.find(t => t.id === technicianId);
    if (!ramesh || ramesh.active_tasks_count !== 1) {
      throw new Error(`Expected Ramesh to have 1 active task, got: ${ramesh ? ramesh.active_tasks_count : 'Not Found'}`);
    }
    console.log(`      ✔ HTTP 200 OK: Ramesh Patel has active_tasks_count = ${ramesh.active_tasks_count}`);

    // 6. Test Non-Existent Technician Error Handling
    console.log('\n[6/6] Testing Validation: Assigning to invalid technician ID 99999...');
    const badAssignReq = {
      user: { id: staffId, role: 'staff' },
      params: { id: complaintId },
      body: { technician_id: 99999 }
    };
    const badAssignRes = createMockRes();
    await StaffController.assignTechnicianToComplaint(badAssignReq, badAssignRes);

    if (badAssignRes.statusCode !== 404) {
      throw new Error(`Expected 404 Not Found, got ${badAssignRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 404 Not Found handled: "${badAssignRes.body.error}"`);

    // Cleanup
    if (complaintId) await ComplaintModel.deleteById(complaintId);
    if (technicianId) await TechnicianModel.deleteById(technicianId);
    if (studentId) await UserModel.deleteById(studentId);
    if (staffId) await UserModel.deleteById(staffId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 11 Technician & Assignment tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Technician API Test Failed:', error.message);
    if (complaintId) await ComplaintModel.deleteById(complaintId).catch(() => {});
    if (technicianId) await TechnicianModel.deleteById(technicianId).catch(() => {});
    if (studentId) await UserModel.deleteById(studentId).catch(() => {});
    if (staffId) await UserModel.deleteById(staffId).catch(() => {});
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testTechnicianAPIs().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testTechnicianAPIs;

