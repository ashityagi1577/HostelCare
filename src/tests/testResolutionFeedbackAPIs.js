const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const FeedbackModel = require('../models/feedback.model');
const StaffController = require('../controllers/staff.controller');
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

async function testResolutionFeedbackFlow() {
  console.log('\n=============================================');
  console.log('   ⭐ HostelCare Resolution & Feedback Test');
  console.log('=============================================\n');

  let student1Id = null;
  let student2Id = null;
  let staffId = null;
  let complaintId = null;

  try {
    // 1. Setup Student & Staff
    console.log('[1/7] Setting up resident and staff test accounts...');
    const student1 = await UserModel.createUser({
      name: 'Riya Sen',
      email: `riya_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block A',
      room_no: 'A-215'
    });
    student1Id = student1.id;

    const student2 = await UserModel.createUser({
      name: 'Other Student',
      email: `other_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block B',
      room_no: 'B-101'
    });
    student2Id = student2.id;

    const staff = await UserModel.createUser({
      name: 'Warden Gupta',
      email: `gupta_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'staff'
    });
    staffId = staff.id;
    console.log(`      ✔ Accounts ready: Student1 #${student1Id}, Student2 #${student2Id}, Staff #${staffId}`);

    // 2. Lodge Complaint
    console.log('\n[2/7] Student lodges a maintenance complaint...');
    const complaint = await ComplaintModel.createComplaint({
      student_id: student1Id,
      category: 'Electrical',
      title: 'Geyser Heating Coil Burnt',
      description: 'Water does not heat up in morning hours.',
      priority: 'High'
    });
    complaintId = complaint.id;
    console.log(`      ✔ Complaint #${complaintId} (${complaint.ticket_no}) lodged, Status: ${complaint.status}`);

    // 3. Premature Feedback Validation (Reject feedback before resolution)
    console.log('\n[3/7] Testing Guard: Student attempts feedback while ticket is Pending...');
    const prematureReq = {
      user: { id: student1Id, role: 'student' },
      params: { id: complaintId },
      body: { rating: 5, comments: 'Nice' }
    };
    const prematureRes = createMockRes();
    await complaintController.submitFeedback(prematureReq, prematureRes);
    if (prematureRes.statusCode !== 400) {
      throw new Error(`Expected 400 Bad Request for premature feedback, got ${prematureRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 400 Bad Request: "${prematureRes.body.error}"`);

    // 4. Staff Marks Complaint as Resolved
    console.log('\n[4/7] Staff marks complaint as Resolved with technician notes...');
    const resolveReq = {
      user: { id: staffId, name: 'Warden Gupta', role: 'staff' },
      params: { id: complaintId },
      body: {
        resolution_notes: 'Replaced burnt 2kW copper heating coil and verified hot water flow at 55 degrees Celsius.'
      }
    };
    const resolveRes = createMockRes();
    await StaffController.resolveComplaint(resolveReq, resolveRes);

    if (resolveRes.statusCode !== 200 || resolveRes.body.data.status !== 'Resolved') {
      throw new Error(`Resolve failed: ${JSON.stringify(resolveRes.body)}`);
    }
    console.log(`      ✔ HTTP 200 OK: ${resolveRes.body.message}`);
    console.log(`      ✔ Resolved At: ${resolveRes.body.data.resolved_at}`);

    // 5. Cross-Student Feedback Protection
    console.log('\n[5/7] Testing Privacy: Student 2 attempts to rate Student 1\'s resolved ticket...');
    const trespassReq = {
      user: { id: student2Id, role: 'student' },
      params: { id: complaintId },
      body: { rating: 3, comments: 'Sneaky rating' }
    };
    const trespassRes = createMockRes();
    await complaintController.submitFeedback(trespassReq, trespassRes);
    if (trespassRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-student rating, got ${trespassRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 403 Forbidden: "${trespassRes.body.error}"`);

    // 6. Valid Feedback Submission
    console.log('\n[6/7] Student 1 submits 5-star rating & review...');
    const feedbackReq = {
      user: { id: student1Id, role: 'student' },
      params: { id: complaintId },
      body: {
        rating: 5,
        comments: 'Prompt repair! Hot water is working perfectly now.'
      }
    };
    const feedbackRes = createMockRes();
    await complaintController.submitFeedback(feedbackReq, feedbackRes);

    if (feedbackRes.statusCode !== 201 || !feedbackRes.body.data.id) {
      throw new Error(`Feedback submission failed: ${JSON.stringify(feedbackRes.body)}`);
    }
    console.log(`      ✔ HTTP 201 Created: ${feedbackRes.body.message}`);
    console.log(`      ✔ Feedback Saved: Rating = ${feedbackRes.body.data.rating} stars`);

    // Verify ticket has automatically moved to 'Closed'
    const closedComplaint = await ComplaintModel.findById(complaintId);
    if (closedComplaint.status !== 'Closed') {
      throw new Error(`Expected complaint to be Closed, found: ${closedComplaint.status}`);
    }
    console.log(`      ✔ Ticket automatically closed: Status = '${closedComplaint.status}'`);

    // 7. Duplicate Feedback Prevention
    console.log('\n[7/7] Testing Duplicate Prevention: Student 1 attempts to re-rate closed ticket...');
    const dupRes = createMockRes();
    await complaintController.submitFeedback(feedbackReq, dupRes);
    if (dupRes.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate feedback, got ${dupRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 409 Conflict: "${dupRes.body.error}"`);

    // Verify satisfaction metric
    const metrics = await FeedbackModel.getAverageRatingMetrics();
    console.log(`\n      ✔ Aggregate Satisfaction Metric: Average ${metrics.average_rating}/5 stars from ${metrics.total_reviews} review(s)`);

    // Cleanup
    if (complaintId) {
      await FeedbackModel.deleteByComplaintId(complaintId);
      await ComplaintModel.deleteById(complaintId);
    }
    if (student1Id) await UserModel.deleteById(student1Id);
    if (student2Id) await UserModel.deleteById(student2Id);
    if (staffId) await UserModel.deleteById(staffId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 12 Resolution & Feedback tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Resolution & Feedback Test Failed:', error.message);
    if (complaintId) {
      await FeedbackModel.deleteByComplaintId(complaintId).catch(() => {});
      await ComplaintModel.deleteById(complaintId).catch(() => {});
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
  testResolutionFeedbackFlow().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testResolutionFeedbackFlow;

