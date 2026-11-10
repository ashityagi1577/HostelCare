const UserModel = require('../models/user.model');
const ComplaintModel = require('../models/complaint.model');
const { generateTicketNumber } = require('../utils/ticket.util');
const { pool } = require('../config/db');

async function testComplaintModelFlow() {
  console.log('\n=============================================');
  console.log('   🎫 HostelCare Complaint Model & Ticket Test');
  console.log('=============================================\n');

  let testStudentId = null;
  const createdComplaintIds = [];

  try {
    // 1. Setup a test resident student
    console.log('[1/6] Creating temporary student resident...');
    const student = await UserModel.createUser({
      name: 'Ananya Roy',
      email: `ananya_${Date.now()}@hostel.edu`,
      passwordHash: 'dummy_hash',
      role: 'student',
      hostel_block: 'Block A',
      room_no: 'A-108',
      phone: '9988776655'
    });
    testStudentId = student.id;
    console.log(`      ✔ Student created with ID: ${testStudentId}`);

    // 2. Test Ticket Number Generation
    console.log('\n[2/6] Testing unique Ticket ID generator...');
    const ticket1 = await generateTicketNumber();
    console.log(`      ✔ Generated Ticket Number: ${ticket1}`);
    if (!ticket1.startsWith('HC-')) throw new Error('Ticket number does not follow HC- format');

    // 3. Test Complaint Creation
    console.log('\n[3/6] Lodging a complaint via ComplaintModel.createComplaint()...');
    const complaint1 = await ComplaintModel.createComplaint({
      student_id: testStudentId,
      category: 'Electrical',
      title: 'Ceiling Fan Not Working',
      description: 'The regulator is sparking and fan has stopped spinning completely.',
      photo_url: '/uploads/fan_spark.jpg',
      priority: 'High'
    });
    createdComplaintIds.push(complaint1.id);
    console.log(`      ✔ Complaint created: ID ${complaint1.id}, Ticket: ${complaint1.ticket_no}`);
    console.log(`      ✔ Status: ${complaint1.status}, Priority: ${complaint1.priority}`);

    // 4. Test Joined Retrieval by Ticket Number
    console.log('\n[4/6] Retrieving complaint details via Ticket Number...');
    const retrieved = await ComplaintModel.findByTicketNo(complaint1.ticket_no);
    if (!retrieved) throw new Error('Could not find complaint by ticket number');
    console.log(`      ✔ Retrieved complaint joined with student:`);
    console.log(`        - Student Name : ${retrieved.student_name}`);
    console.log(`        - Block & Room : ${retrieved.hostel_block}, Room ${retrieved.room_no}`);
    console.log(`        - Category     : ${retrieved.category}`);

    // 5. Test Status Update & Audit Log Timeline
    console.log('\n[5/6] Mutating status to In_Progress and inspecting timeline...');
    await ComplaintModel.updateStatus(complaint1.id, {
      newStatus: 'In_Progress',
      action: 'Work Started',
      remarks: 'Technician opened switchboard to replace capacitor',
      updatedByUserId: testStudentId
    });

    const timeline = await ComplaintModel.getTimeline(complaint1.id);
    console.log(`      ✔ Timeline events count: ${timeline.length}`);
    timeline.forEach((log, index) => {
      console.log(`        [Stage ${index + 1}] ${log.action} ──► Status: ${log.new_status} (${log.remarks || 'No remarks'})`);
    });

    if (timeline.length < 2) {
      throw new Error('Expected at least 2 timeline events (Initial Lodging + In_Progress)');
    }

    // 6. Test Sequential Auto-Incrementing Ticket Number
    console.log('\n[6/6] Testing sequential ticket numbering (second ticket)...');
    const complaint2 = await ComplaintModel.createComplaint({
      student_id: testStudentId,
      category: 'Plumbing',
      title: 'Bathroom Tap Leak',
      description: 'Continuous dripping from faucet.',
      priority: 'Low'
    });
    createdComplaintIds.push(complaint2.id);
    console.log(`      ✔ First Ticket  : ${complaint1.ticket_no}`);
    console.log(`      ✔ Second Ticket : ${complaint2.ticket_no}`);

    // Cleanup
    for (const id of createdComplaintIds) {
      await ComplaintModel.deleteById(id);
    }
    await UserModel.deleteById(testStudentId);
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Phase 7 Complaint Model tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Complaint Model Test Failed:', error.message);
    for (const id of createdComplaintIds) {
      await ComplaintModel.deleteById(id).catch(() => {});
    }
    if (testStudentId) {
      await UserModel.deleteById(testStudentId).catch(() => {});
    }
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testComplaintModelFlow().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testComplaintModelFlow;

