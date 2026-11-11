const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const FeedbackModel = require('../models/feedback.model');
const AnalyticsController = require('../controllers/analytics.controller');
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

async function testAnalyticsAPIs() {
  console.log('\n=============================================');
  console.log('   📊 HostelCare Administrative Analytics Test');
  console.log('=============================================\n');

  let student1Id = null;
  let student2Id = null;
  let staffId = null;
  const createdComplaintIds = [];

  try {
    // 1. Setup Accounts
    console.log('[1/5] Creating test students and warden accounts...');
    const student1 = await UserModel.createUser({
      name: 'Devansh Pandey',
      email: `devansh_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block A (Boys)',
      room_no: 'A-102'
    });
    student1Id = student1.id;

    const student2 = await UserModel.createUser({
      name: 'Meera Iyer',
      email: `meera_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block B (Girls)',
      room_no: 'B-205'
    });
    student2Id = student2.id;

    const staff = await UserModel.createUser({
      name: 'Chief Warden',
      email: `warden_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'staff'
    });
    staffId = staff.id;
    console.log(`      ✔ Students #${student1Id}, #${student2Id} and Staff #${staffId} created.`);

    // 2. Seed diverse complaints for aggregation
    console.log('\n[2/5] Seeding diverse complaints for metrics calculation...');
    // Complaint 1: Emergency Pending in Block A
    const c1 = await ComplaintModel.createComplaint({
      student_id: student1Id,
      category: 'Plumbing',
      title: 'Major Pipeline Leakage',
      description: 'Water leaking into electric switchboard area.',
      priority: 'Emergency'
    });
    createdComplaintIds.push(c1.id);

    // Complaint 2: Electrical Resolved & Rated in Block B
    const c2 = await ComplaintModel.createComplaint({
      student_id: student2Id,
      category: 'Electrical',
      title: 'Power Socket Sparking',
      description: 'Socket not grounding properly.',
      priority: 'Medium'
    });
    createdComplaintIds.push(c2.id);

    // Resolve c2 and add feedback
    await ComplaintModel.resolveComplaint(c2.id, {
      resolutionNotes: 'Replaced socket unit and verified earthing wire.',
      updatedByUserId: staffId
    });
    await FeedbackModel.createFeedback({
      complaint_id: c2.id,
      student_id: student2Id,
      rating: 5,
      comments: 'Very quick resolution by staff!'
    });
    console.log(`      ✔ Seeded: #${c1.id} (Emergency Pending, Block A) & #${c2.id} (Resolved & 5-Star Rated, Block B)`);

    // 3. Test Dashboard KPI Retrieval
    console.log('\n[3/5] Testing GET /api/analytics/dashboard (Staff Access)...');
    const staffReq = { user: { id: staffId, role: 'staff' } };
    const staffRes = createMockRes();
    await AnalyticsController.getDashboardMetrics(staffReq, staffRes);

    if (staffRes.statusCode !== 200 || !staffRes.body.success) {
      throw new Error(`Analytics endpoint failed: ${JSON.stringify(staffRes.body)}`);
    }

    const { kpis, by_category, by_priority, by_block, satisfaction, recent_activity } = staffRes.body.data;

    console.log('      ✔ KPI Summary Cards:');
    console.log(`        - Total Complaints    : ${kpis.total}`);
    console.log(`        - Active Backlog      : ${kpis.active_total}`);
    console.log(`        - Emergency Pending   : ${kpis.emergency_pending}`);
    console.log(`        - Resolved / Closed   : ${kpis.resolved + kpis.closed}`);

    if (kpis.emergency_pending < 1) {
      throw new Error('Emergency pending count calculation is inaccurate');
    }

    // 4. Verify Dimension Breakdowns
    console.log('\n[4/5] Verifying Analytical Breakdowns...');
    console.log(`      ✔ Category Breakdown: ${by_category.map(c => `${c.category} (${c.count})`).join(', ')}`);
    console.log(`      ✔ Priority Breakdown: ${by_priority.map(p => `${p.priority} (${p.count})`).join(', ')}`);
    console.log(`      ✔ Block Breakdown   : ${by_block.map(b => `${b.block} (${b.count})`).join(', ')}`);
    console.log(`      ✔ Satisfaction Score: ${satisfaction.average_rating}/5.0 (from ${satisfaction.total_reviews} reviews)`);
    console.log(`      ✔ Recent Activity   : ${recent_activity.length} event items captured`);

    if (by_category.length === 0 || by_block.length === 0) {
      throw new Error('Dimension aggregations returned empty results');
    }

    // 5. Test Role Guard (Student blocked from analytics)
    console.log('\n[5/5] Testing Role Guard (Student blocked from staff analytics)...');
    // Using requireRoles middleware
    const { requireRoles } = require('../middleware/auth.middleware');
    const guard = requireRoles('staff', 'admin');
    const guardReq = { user: { role: 'student' } };
    const guardRes = createMockRes();
    let nextCalled = false;
    guard(guardReq, guardRes, () => { nextCalled = true; });

    if (nextCalled || guardRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for student on analytics, got ${guardRes.statusCode}`);
    }
    console.log(`      ✔ HTTP 403 Forbidden: "${guardRes.body.error}"`);

    // Cleanup
    for (const id of createdComplaintIds) {
      await FeedbackModel.deleteByComplaintId(id).catch(() => {});
      await ComplaintModel.deleteById(id).catch(() => {});
    }
    if (student1Id) await UserModel.deleteById(student1Id);
    if (student2Id) await UserModel.deleteById(student2Id);
    if (staffId) await UserModel.deleteById(staffId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 13 Analytics & Metrics tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Analytics Test Failed:', error.message);
    for (const id of createdComplaintIds) {
      await FeedbackModel.deleteByComplaintId(id).catch(() => {});
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
  testAnalyticsAPIs().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testAnalyticsAPIs;

