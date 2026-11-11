const { pool } = require('../config/db');
const { hashPassword } = require('../utils/password.util');

/**
 * Seeds initial demo accounts and technicians for HostelCare.
 */
async function seedDatabase() {
  console.log('\n=============================================');
  console.log('   🌱 Seeding Demo Accounts for HostelCare');
  console.log('=============================================\n');

  try {
    const defaultPassword = 'password123';
    const passwordHash = await hashPassword(defaultPassword);

    // 1. Seed Users (Student, Staff, Admin)
    const users = [
      {
        name: 'Aarav Sharma',
        email: 'student@hostelcare.com',
        role: 'student',
        hostel_block: 'Block A (Boys)',
        room_no: 'A-204',
        phone: '9876543210'
      },
      {
        name: 'Priya Verma',
        email: 'priya@hostelcare.com',
        role: 'student',
        hostel_block: 'Block C (Girls)',
        room_no: 'C-105',
        phone: '9876543211'
      },
      {
        name: 'Warden Ramesh Mukherjee',
        email: 'staff@hostelcare.com',
        role: 'staff',
        hostel_block: null,
        room_no: null,
        phone: '9876543222'
      },
      {
        name: 'Chief Hostel Administrator',
        email: 'admin@hostelcare.com',
        role: 'admin',
        hostel_block: null,
        room_no: null,
        phone: '9876543333'
      }
    ];

    console.log('1. Inserting Users...');
    for (const u of users) {
      // Upsert: update password if email already exists
      const sql = `
        INSERT INTO users (name, email, password_hash, role, hostel_block, room_no, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name),
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          hostel_block = VALUES(hostel_block),
          room_no = VALUES(room_no),
          phone = VALUES(phone);
      `;
      await pool.execute(sql, [u.name, u.email, passwordHash, u.role, u.hostel_block, u.room_no, u.phone]);
      console.log(`   ✔ User ready: ${u.email.padEnd(25)} [${u.role.toUpperCase()}]`);
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
    for (const t of technicians) {
      const [existing] = await pool.query('SELECT id FROM technicians WHERE phone = ? LIMIT 1;', [t.phone]);
      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO technicians (name, trade, phone, is_available) VALUES (?, ?, ?, 1);',
          [t.name, t.trade, t.phone]
        );
        console.log(`   ✔ Technician created: ${t.name.padEnd(18)} (${t.trade})`);
      } else {
        console.log(`   ✔ Technician exists : ${t.name.padEnd(18)} (${t.trade})`);
      }
    }

    console.log('\n---------------------------------------------');
    console.log('  🎉 Database seeded successfully!');
    console.log(`  All accounts have password: "${defaultPassword}"`);
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('Seeding error:', error);
    return false;
  }
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = seedDatabase;

