const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const { TimelineService } = require('../services/timeline.service');
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

async function testTimelineServiceFlow() {
  console.log('\n=============================================');
  console.log('   ⏱️ HostelCare Timeline & Stepper Test');
  console.log('=============================================\n');

  let testStudentId = null;
  let testStaffId = null;
  let complaintId = null;
  let ticketNo = null;

  try {
    // 1. Setup Student & Staff
    console.log('[1/5] Setting up student and warden test users...');
    const student = await UserModel.createUser({
      name: 'Sahil Kapoor',
      email: `sahil_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block C',
      room_no: 'C-305'
    });
    testStudentId = student.id;

    const staff = await UserModel.createUser({
      name: 'Supervisor Anil',
      email: `anil_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'staff'
    });
    testStaffId = staff.id;
    console.log(`      ✔ Created Student #${testStudentId} and Staff #${testStaffId}`);

    // 2. Stage 1: Lodge Complaint (Pending)
    console.log('\n[2/5] Stage 1: Student lodges complaint (Status: Pending)...');
    const complaint = await ComplaintModel.createComplaint({
      student_id: testStudentId,
      category: 'Carpentry',
      title: 'Broken Study Table Leg',
      description: 'The front-right leg of the study desk has detached completely.',
      priority: 'Medium'
    });
    complaintId = complaint.id;
    ticketNo = complaint.ticket_no;

    let timelineData = await TimelineService.getEnrichedTimeline(complaint);
    console.log(`      ✔ Ticket: ${ticketNo}, Stepper Nodes: ${timelineData.stepper.length}`);
    console.log(`      ✔ Step 1 [${timelineData.stepper[0].label}]: ${timelineData.stepper[0].state}`);
    console.log(`      ✔ Step 2 [${timelineData.stepper[1].label}]: ${timelineData.stepper[1].state}`);

    if (timelineData.stepper[0].state !== 'current' || timelineData.stepper[1].state !== 'upcoming') {
      throw new Error('Initial stepper state is incorrect');
    }

    // 3. Stage 2 & 3: Assign Technician and Start Work
    console.log('\n[3/5] Stage 2 & 3: Assigning technician & commencing repair...');
    await ComplaintModel.updateStatus(complaintId, {
      newStatus: 'Assigned',
      action: 'Technician Assigned',
      remarks: 'Assigned to Master Carpenter Jagdish',
      updatedByUserId: testStaffId
    });

    await ComplaintModel.updateStatus(complaintId, {
      newStatus: 'In_Progress',
      action: 'Carpentry Work Begun',
      remarks: 'Technician on-site fixing desk joints with wood adhesive and screws',
      updatedByUserId: testStaffId
    });

    const activeComplaint = await ComplaintModel.findById(complaintId);
    timelineData = await TimelineService.getEnrichedTimeline(activeComplaint);
    console.log(`      ✔ Step 1 [${timelineData.stepper[0].label}]: ${timelineData.stepper[0].state}`);
    console.log(`      ✔ Step 2 [${timelineData.stepper[1].label}]: ${timelineData.stepper[1].state}`);
    console.log(`      ✔ Step 3 [${timelineData.stepper[2].label}]: ${timelineData.stepper[2].state}`);

    if (timelineData.stepper[0].state !== 'completed' || timelineData.stepper[1].state !== 'completed' || timelineData.stepper[2].state !== 'current') {
      throw new Error('Midway stepper progression failed');
    }

    // 4. Stage 4 & 5: Resolve Complaint and Close Ticket
    console.log('\n[4/5] Stage 4 & 5: Resolving complaint and closing ticket...');
    await ComplaintModel.resolveComplaint(complaintId, {
      resolutionNotes: 'Desk leg reinforced with heavy-duty metal brackets and re-leveled.',
      updatedByUserId: testStaffId
    });

    await ComplaintModel.updateStatus(complaintId, {
      newStatus: 'Closed',
      action: 'Ticket Closed & Feedback Submitted',
      remarks: 'Student rated 5 stars: Great service and quick repair!',
      updatedByUserId: testStudentId
    });

    const closedComplaint = await ComplaintModel.findById(complaintId);
    timelineData = await TimelineService.getEnrichedTimeline(closedComplaint);

    console.log('      ✔ Final Stepper States:');
    timelineData.stepper.forEach(s => {
      console.log(`        Step ${s.step}: ${s.label.padEnd(22)} ──► [${s.state.toUpperCase()}]`);
    });
    console.log(`      ✔ Resolution Turnaround Metric: ${timelineData.resolution_time_hours} hr(s)`);
    console.log(`      ✔ Total Chronological Log Entries: ${timelineData.history.length}`);

    // 5. Test Controller Endpoint GET /api/complaints/:identifier/timeline
    console.log('\n[5/5] Testing Controller Endpoint GET /api/complaints/:identifier/timeline...');
    const apiReq = {
      user: { id: testStudentId, role: 'student' },
      params: { identifier: ticketNo }
    };
    const apiRes = createMockRes();
    await complaintController.getComplaintTimeline(apiReq, apiRes);

    if (apiRes.statusCode !== 200 || !apiRes.body.data.stepper) {
      throw new Error(`Timeline endpoint failed: ${JSON.stringify(apiRes.body)}`);
    }
    console.log(`      ✔ HTTP 200 OK: Controller successfully returned enriched timeline for ${ticketNo}`);

    // Cleanup
    if (complaintId) await ComplaintModel.deleteById(complaintId);
    if (testStudentId) await UserModel.deleteById(testStudentId);
    if (testStaffId) await UserModel.deleteById(testStaffId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 9 Timeline & Stepper tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Timeline Test Failed:', error.message);
    if (complaintId) await ComplaintModel.deleteById(complaintId).catch(() => {});
    if (testStudentId) await UserModel.deleteById(testStudentId).catch(() => {});
    if (testStaffId) await UserModel.deleteById(testStaffId).catch(() => {});
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testTimelineServiceFlow().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testTimelineServiceFlow;

