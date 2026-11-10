const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const complaintController = require('../controllers/complaint.controller');
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

async function testStudentAPIs() {
  console.log('\n=============================================');
  console.log('   📋 HostelCare Student Complaint APIs Test');
  console.log('=============================================\n');

  let student1Id = null;
  let student2Id = null;
  let staffId = null;
  const createdComplaintIds = [];
  let generatedTicketNo = null;

  try {
    // 1. Create two test students and one staff user
    console.log('[1/7] Creating test accounts (2 students, 1 staff)...');
    const student1 = await UserModel.createUser({
      name: 'Kavita Rao',
      email: `kavita_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block A (Girls)',
      room_no: 'A-201',
      phone: '9876543211'
    });
    student1Id = student1.id;

    const student2 = await UserModel.createUser({
      name: 'Aditya Kumar',
      email: `aditya_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block B (Boys)',
      room_no: 'B-105',
      phone: '9876543212'
    });
    student2Id = student2.id;

    const staff = await UserModel.createUser({
      name: 'Warden Sharma',
      email: `warden_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'staff',
      phone: '9876543213'
    });
    staffId = staff.id;
    console.log(`      ✔ Accounts ready: Student1 #${student1Id}, Student2 #${student2Id}, Staff #${staffId}`);

    // 2. Test Lodge Complaint (Valid)
    console.log('\n[2/7] Testing POST /api/complaints (Student 1 lodges complaint)...');
    const lodgeReq = {
      user: { id: student1Id, role: 'student' },
      body: {
        category: 'Plumbing',
        title: 'Geyser Pipe Leakage',
        description: 'Hot water pipe is spurting water in bathroom 201, needs urgent fix.',
        priority: 'Emergency'
      },
      file: {
        filename: 'complaint-test-leak.jpg',
        relativeUrl: '/uploads/complaint-test-leak.jpg'
      }
    };
    const lodgeRes = createMockRes();
    await complaintController.lodgeComplaint(lodgeReq, lodgeRes);

    if (lodgeRes.statusCode !== 201 || !lodgeRes.body.success) {
      throw new Error(`Failed to lodge complaint: ${JSON.stringify(lodgeRes.body)}`);
    }
    const created = lodgeRes.body.data;
    generatedTicketNo = created.ticket_no;
    createdComplaintIds.push(created.id);
    console.log(`      ✔ HTTP 201 Created: Ticket ${generatedTicketNo}, Status: ${created.status}, Priority: ${created.priority}`);

    // 3. Test Invalid Category Validation
    console.log('\n[3/7] Testing Validation: Invalid Category...');
    const invalidCatReq = {
      user: { id: student1Id, role: 'student' },
      body: {
        category: 'NonExistentCategory',
        title: 'Broken window latch',
        description: 'Window does not close properly during rain.'
      }
    };
    const invalidCatRes = createMockRes();
    await complaintController.lodgeComplaint(invalidCatReq, invalidCatRes);
    if (invalidCatRes.statusCode !== 400) {
      throw new Error(`Expected 400 Bad Request for invalid category, got ${invalidCatRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 400 Bad Request: "${invalidCatRes.body.error}"`);

    // 4. Test Short Description Validation
    console.log('\n[4/7] Testing Validation: Short Description (< 10 chars)...');
    const shortDescReq = {
      user: { id: student1Id, role: 'student' },
      body: {
        category: 'Electrical',
        title: 'Fan broken',
        description: 'broken'
      }
    };
    const shortDescRes = createMockRes();
    await complaintController.lodgeComplaint(shortDescReq, shortDescRes);
    if (shortDescRes.statusCode !== 400) {
      throw new Error(`Expected 400 Bad Request for short description, got ${shortDescRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 400 Bad Request: "${shortDescRes.body.error}"`);

    // 5. Test GET /api/complaints/my (Student 1 retrieves their list)
    console.log('\n[5/7] Testing GET /api/complaints/my (Student 1 retrieves complaints)...');
    const myReq = {
      user: { id: student1Id, role: 'student' },
      query: {}
    };
    const myRes = createMockRes();
    await complaintController.getMyComplaints(myReq, myRes);

    if (myRes.statusCode !== 200 || myRes.body.count < 1) {
      throw new Error(`Expected at least 1 complaint for student 1, got ${myRes.body.count}`);
    }
    console.log(`      ✔ HTTP 200 OK: Found ${myRes.body.count} complaint(s) for Student 1`);

    // 6. Test Privacy Protection: Student 2 blocked from viewing Student 1's ticket
    console.log('\n[6/7] Testing Privacy: Student 2 blocked from viewing Student 1\'s ticket...');
    const s2Req = {
      user: { id: student2Id, role: 'student' },
      params: { ticketNo: generatedTicketNo }
    };
    const s2Res = createMockRes();
    await complaintController.getComplaintByTicket(s2Req, s2Res);
    if (s2Res.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for Student 2 snooping on Student 1, got ${s2Res.statusCode}`);
    }
    console.log(`      ✔ HTTP 403 Forbidden: "${s2Res.body.error}"`);

    // 7. Test Staff Access: Staff user CAN view any student's ticket
    console.log('\n[7/7] Testing Staff Authorization: Staff accesses ticket...');
    const staffReq = {
      user: { id: staffId, role: 'staff' },
      params: { ticketNo: generatedTicketNo }
    };
    const staffRes = createMockRes();
    await complaintController.getComplaintByTicket(staffReq, staffRes);
    if (staffRes.statusCode !== 200 || !staffRes.body.data.timeline) {
      throw new Error(`Staff could not view ticket: ${JSON.stringify(staffRes.body)}`);
    }
    console.log(`      ✔ HTTP 200 OK: Staff retrieved ticket with ${staffRes.body.data.timeline.length} timeline event(s)`);

    // Cleanup
    for (const id of createdComplaintIds) {
      await ComplaintModel.deleteById(id);
    }
    if (student1Id) await UserModel.deleteById(student1Id);
    if (student2Id) await UserModel.deleteById(student2Id);
    if (staffId) await UserModel.deleteById(staffId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 8 Student Complaint API tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Student API Test Failed:', error.message);
    for (const id of createdComplaintIds) {
      await ComplaintModel.deleteById(id).catch(() => {});
    }
    if (student1Id) await UserModel.deleteById(student1Id).catch(() => {});
    if (student2Id) await UserModel.deleteById(student2Id).catch(() => {});
    if (staffId) await UserModel.deleteById(staffId).catch(() => {});
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testStudentAPIs().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testStudentAPIs;

