const db = require('../config/db');

/**
 * Generates an institutional, human-readable unique ticket number.
 * Format: HC-YYYY-XXXX (e.g. HC-2026-0001, HC-2026-0042)
 * 
 * Uses the highest existing ticket number for the current calendar year,
 * ensuring sequential, collision-free numbering.
 * 
 * @returns {Promise<string>} The generated ticket number
 */
async function generateTicketNumber() {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `HC-${currentYear}-`;

  // Find the highest sequence number for this year
  const sql = `
    SELECT ticket_no 
    FROM complaints 
    WHERE ticket_no LIKE ? 
    ORDER BY id DESC 
    LIMIT 1;
  `;
  const rows = await db.query(sql, [`${yearPrefix}%`]);

  let nextSequence = 1;

  if (rows.length > 0 && rows[0].ticket_no) {
    const lastTicket = rows[0].ticket_no; // e.g. "HC-2026-0042"
    const lastNumberStr = lastTicket.replace(yearPrefix, '');
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextSequence = lastNumber + 1;
    }
  }

  // Zero-pad to 4 digits (e.g., 0001, 0042, 1200)
  const paddedSequence = String(nextSequence).padStart(4, '0');
  return `${yearPrefix}${paddedSequence}`;
}

module.exports = {
  generateTicketNumber
};

