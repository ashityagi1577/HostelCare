const { pool } = require('../config/db');
const { hashPassword } = require('../utils/password.util');

/**
 * Rich Demo Data Seeder for HostelCare PBL Project
 * Populates realistic accounts, technicians, complaints across all states, timelines, and feedback.
 */
async function seedDatabase() {
  console.log('\n=============================================');
  console.log('   🌱 Seeding Rich Demo Dataset for HostelCare');
  console.log('=============================================\n');

  try {
    const defaultPassword = 'password123';
    const passwordHash = await hashPassword(defaultPassword);

    // 1. Seed Users (Students, Staff, Admin)
    const users = [
      {
        user_id: 'STU-101',
        name: 'Aarav Sharma',
        email: 'student@hostelcare.com',
        role: 'student',
        hostel_block: 'Block A (Boys)',
        room_no: 'A-204',
        phone: '9876543210'
      },
      {
        user_id: 'STU-102',
        name: 'Priya Verma',
        email: 'priya@hostelcare.com',
        role: 'student',
        hostel_block: 'Block C (Girls)',
        room_no: 'C-105',
        phone: '9876543211'
      },
      {
        user_id: 'STU-103',
        name: 'Rahul Nair',
        email: 'rahul@hostelcare.com',
        role: 'student',
        hostel_block: 'Block B (Boys)',
        room_no: 'B-112',
        phone: '9876543212'
      },
      {
        user_id: 'STU-104',
        name: 'Sneha Patel',
        email: 'sneha@hostelcare.com',
        role: 'student',
        hostel_block: 'Block D (Girls)',
        room_no: 'D-301',
        phone: '9876543213'
      },
      {
        user_id: 'STF-101',
        name: 'Warden Ramesh Mukherjee',
        email: 'staff@hostelcare.com',
        role: 'staff',
        hostel_block: null,
        room_no: null,
        phone: '9876543222'
      },
      {
        user_id: 'ADM-101',
        name: 'Chief Hostel Administrator',
        email: 'admin@hostelcare.com',
        role: 'admin',
        hostel_block: null,
        room_no: null,
        phone: '9876543333'
      }
    ];

    console.log('1. Inserting Users...');
    const userMap = {};
    for (const u of users) {
      const sql = `
        INSERT INTO users (user_id, name, email, password_hash, role, hostel_block, room_no, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          user_id = VALUES(user_id),
          name = VALUES(name),
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          hostel_block = VALUES(hostel_block),
          room_no = VALUES(room_no),
          phone = VALUES(phone);
      `;
      await pool.execute(sql, [u.user_id, u.name, u.email, passwordHash, u.role, u.hostel_block, u.room_no, u.phone]);
      const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1;', [u.email]);
      userMap[u.email] = rows[0].id;
      console.log(`   ✔ User ready: ${u.user_id.padEnd(8)} | ${u.email.padEnd(25)} [${u.role.toUpperCase()}]`);
    }

    // 2. Seed Technicians
    const technicians = [
      { name: 'Ramesh Patel', trade: 'Electrical', phone: '9822334455' },
      { name: 'Dinesh Kumar', trade: 'Plumbing', phone: '9833445566' },
      { name: 'Suresh Mistry', trade: 'Carpentry', phone: '9844556677' },
      { name: 'Sunita Bai', trade: 'Cleaning', phone: '9855667788' },
      { name: 'Vikram Joshi', trade: 'WiFi_Internet', phone: '9866778899' }
    ];

    console.log('\n2. Inserting Technicians...');
    const techMap = {};
    for (const t of technicians) {
      const [existing] = await pool.query('SELECT id FROM technicians WHERE phone = ? LIMIT 1;', [t.phone]);
      if (existing.length === 0) {
        const [result] = await pool.execute(
          'INSERT INTO technicians (name, trade, phone, is_available) VALUES (?, ?, ?, 1);',
          [t.name, t.trade, t.phone]
        );
        techMap[t.trade] = result.insertId;
        console.log(`   ✔ Technician created: ${t.name.padEnd(18)} (${t.trade}) (ID: ${result.insertId})`);
      } else {
        techMap[t.trade] = existing[0].id;
        console.log(`   ✔ Technician exists : ${t.name.padEnd(18)} (${t.trade}) (ID: ${existing[0].id})`);
      }
    }

    // 3. Seed Diverse Complaints
    console.log('\n3. Inserting Comprehensive Complaints Dataset...');

    const complaintsData = [
      {
        ticket_no: 'HC-2026-0001',
        student_email: 'student@hostelcare.com',
        category: 'Electrical',
        title: 'Geyser heating element sparking in Room A-204',
        description: 'The geyser makes a loud crackling spark noise when switched on. Water does not heat and circuit smells burnt.',
        priority: 'Emergency',
        status: 'Assigned',
        tech_trade: 'Electrical',
        estimated_date: new Date(Date.now() + 86400000), // tomorrow
        resolution_notes: null,
        resolved_at: null,
        created_at: new Date(Date.now() - 3600000 * 5) // 5 hours ago
      },
      {
        ticket_no: 'HC-2026-0002',
        student_email: 'rahul@hostelcare.com',
        category: 'Plumbing',
        title: 'Water pipe leaking under bathroom washbasin',
        description: 'Continuous leaking from the drain pipe joint. The floor is flooded and needs pipe joint tightening or gasket replacement.',
        priority: 'High',
        status: 'In_Progress',
        tech_trade: 'Plumbing',
        estimated_date: new Date(Date.now() + 86400000 * 2),
        resolution_notes: null,
        resolved_at: null,
        created_at: new Date(Date.now() - 3600000 * 12) // 12 hours ago
      },
      {
        ticket_no: 'HC-2026-0003',
        student_email: 'priya@hostelcare.com',
        category: 'WiFi_Internet',
        title: 'Wi-Fi access point offline on 2nd floor corridor',
        description: 'SSID HostelNet_C2 is not broadcasting since yesterday evening. Students unable to access course portals.',
        priority: 'Medium',
        status: 'Resolved',
        tech_trade: 'WiFi_Internet',
        estimated_date: new Date(Date.now() - 3600000 * 4),
        resolution_notes: 'Rebooted PoE switch on 2nd floor rack and updated AP firmware. All channels operating at 5GHz with full signal.',
        resolved_at: new Date(Date.now() - 3600000 * 2),
        created_at: new Date(Date.now() - 3600000 * 24) // 1 day ago
      },
      {
        ticket_no: 'HC-2026-0004',
        student_email: 'priya@hostelcare.com',
        category: 'Carpentry',
        title: 'Wardrobe door hinges completely detached',
        description: 'Top and bottom hinges of left wooden cupboard fell off due to stripped screws. Door is detached.',
        priority: 'Medium',
        status: 'Closed',
        tech_trade: 'Carpentry',
        estimated_date: new Date(Date.now() - 3600000 * 30),
        resolution_notes: 'Replaced stripped 1-inch screws with heavy-duty 2-inch wood screws and aligned door latch. Operating smoothly.',
        resolved_at: new Date(Date.now() - 3600000 * 20),
        created_at: new Date(Date.now() - 3600000 * 48) // 2 days ago
      },
      {
        ticket_no: 'HC-2026-0005',
        student_email: 'sneha@hostelcare.com',
        category: 'Cleaning',
        title: 'Deep cleaning required for room balcony & window mesh',
        description: 'Pigeon droppings and dust accumulated heavily on window mesh and balcony floor.',
        priority: 'Low',
        status: 'Closed',
        tech_trade: 'Cleaning',
        estimated_date: new Date(Date.now() - 3600000 * 40),
        resolution_notes: 'Sanitized balcony using pressure wash, disinfectant solution, and cleaned nylon window mesh.',
        resolved_at: new Date(Date.now() - 3600000 * 24),
        created_at: new Date(Date.now() - 3600000 * 72) // 3 days ago
      },
      {
        ticket_no: 'HC-2026-0006',
        student_email: 'student@hostelcare.com',
        category: 'Electrical',
        title: 'Ceiling fan regulator knob broken',
        description: 'Speed control regulator knob is stuck at maximum speed 5. Cannot turn down.',
        priority: 'Low',
        status: 'Pending',
        tech_trade: null,
        estimated_date: null,
        resolution_notes: null,
        resolved_at: null,
        created_at: new Date(Date.now() - 3600000 * 2) // 2 hours ago
      },
      {
        ticket_no: 'HC-2026-0007',
        student_email: 'rahul@hostelcare.com',
        category: 'Plumbing',
        title: 'Main flush valve continuous overflow in Room B-112',
        description: 'Cistern inlet valve is jammed and water continuously overflows into toilet bowl, wasting clean water.',
        priority: 'Emergency',
        status: 'Pending',
        tech_trade: null,
        estimated_date: null,
        resolution_notes: null,
        resolved_at: null,
        created_at: new Date(Date.now() - 3600000 * 1) // 1 hour ago
      }
    ];

    const toMysqlDate = (d) => {
      if (!d) return null;
      return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
    };

    for (const c of complaintsData) {
      const studentId = userMap[c.student_email];
      const techId = c.tech_trade ? techMap[c.tech_trade] : null;

      const [existing] = await pool.query('SELECT id FROM complaints WHERE ticket_no = ? LIMIT 1;', [c.ticket_no]);

      let complaintId;
      if (existing.length === 0) {
        const insertSql = `
          INSERT INTO complaints (
            ticket_no, student_id, category, title, description, priority, 
            status, assigned_tech_id, estimated_date, resolution_notes, resolved_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const [res] = await pool.execute(insertSql, [
          c.ticket_no,
          studentId,
          c.category,
          c.title,
          c.description,
          c.priority,
          c.status,
          techId,
          toMysqlDate(c.estimated_date),
          c.resolution_notes,
          toMysqlDate(c.resolved_at),
          toMysqlDate(c.created_at)
        ]);
        complaintId = res.insertId;
        console.log(`   ✔ Complaint created : ${c.ticket_no} [${c.status}] - ${c.title.slice(0, 35)}...`);
      } else {
        complaintId = existing[0].id;
        console.log(`   ✔ Complaint exists  : ${c.ticket_no} (ID: ${complaintId})`);
      }

      // 4. Seed Audit Logs for Timeline Stepper
      const [logs] = await pool.query('SELECT id FROM complaint_logs WHERE complaint_id = ? LIMIT 1;', [complaintId]);
      if (logs.length === 0) {
        const staffUserId = userMap['staff@hostelcare.com'];

        // Step 1: Lodged
        await pool.execute(
          `INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks, created_at)
           VALUES (?, 'Complaint Lodged', NULL, 'Pending', ?, 'Complaint submitted by resident via student portal', ?);`,
          [complaintId, studentId, toMysqlDate(c.created_at)]
        );

        // Step 2: Assigned (if applicable)
        if (c.status !== 'Pending') {
          const assignTime = new Date(c.created_at.getTime() + 1800000); // 30 mins later
          await pool.execute(
            `INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks, created_at)
             VALUES (?, 'Technician Assigned', 'Pending', 'Assigned', ?, ?, ?);`,
            [complaintId, staffUserId, `Allocated to technician (${c.tech_trade}) with priority ${c.priority}`, toMysqlDate(assignTime)]
          );
        }

        // Step 3: In Progress (if applicable)
        if (c.status === 'In_Progress' || c.status === 'Resolved' || c.status === 'Closed') {
          const progressTime = new Date(c.created_at.getTime() + 3600000); // 1 hr later
          await pool.execute(
            `INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks, created_at)
             VALUES (?, 'Work Underway', 'Assigned', 'In_Progress', ?, 'Technician arrived on-site and commenced inspection', ?);`,
            [complaintId, staffUserId, toMysqlDate(progressTime)]
          );
        }

        // Step 4: Resolved (if applicable)
        if (c.status === 'Resolved' || c.status === 'Closed') {
          await pool.execute(
            `INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks, created_at)
             VALUES (?, 'Work Completed', 'In_Progress', 'Resolved', ?, ?, ?);`,
            [complaintId, staffUserId, c.resolution_notes || 'Repairs completed and tested.', toMysqlDate(c.resolved_at)]
          );
        }

        // Step 5: Closed & Rated (if applicable)
        if (c.status === 'Closed') {
          const closeTime = new Date(c.resolved_at.getTime() + 1800000);
          await pool.execute(
            `INSERT INTO complaint_logs (complaint_id, action, previous_status, new_status, updated_by_user_id, remarks, created_at)
             VALUES (?, 'Feedback Submitted & Ticket Closed', 'Resolved', 'Closed', ?, 'Resident inspected repair, rated 5 stars, and closed ticket', ?);`,
            [complaintId, studentId, toMysqlDate(closeTime)]
          );

          // Seed Feedback record
          const [fbExists] = await pool.query('SELECT id FROM feedback WHERE complaint_id = ? LIMIT 1;', [complaintId]);
          if (fbExists.length === 0) {
            const rating = c.ticket_no === 'HC-2026-0004' ? 5 : 4;
            const comments = c.ticket_no === 'HC-2026-0004' 
              ? 'Suresh Mistry fixed the wardrobe perfectly. Heavy duty screws used, very polite and on time!' 
              : 'Balcony looks super clean now. Quick work by cleaning team.';
            await pool.execute(
              `INSERT INTO feedback (complaint_id, student_id, rating, comments, created_at)
               VALUES (?, ?, ?, ?, ?);`,
              [complaintId, studentId, rating, comments, toMysqlDate(closeTime)]
            );
          }
        }
      }
    }

    console.log('\n---------------------------------------------');
    console.log('  🎉 Rich Demo Dataset Seeded Successfully!');
    console.log(`  Default Demo Password: "${defaultPassword}" for all users.`);
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('Seeding error:', error);
    return false;
  }
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = seedDatabase;
