import { pgPool } from "./src/config/pg.js";

async function testQuery() {
  try {
    const { rows } = await pgPool.query(
      `SELECT p.payment_id, p.student_id, p.amount, p.fee_type, p.payment_method,
              p.reference_number, p.payment_date, p.status, p.paid_by,
              s.first_name, s.last_name, s.class_name
      FROM payments p
      LEFT JOIN students s ON s.student_id = p.student_id AND s.is_deleted = false
      WHERE p.school_id = $1 AND p.is_deleted = false
      ORDER BY p.payment_date DESC, p.payment_id DESC`,
      [1]
    );
    console.log("Query successful:", rows.length, "rows");
  } catch (err) {
    console.error("Query failed:", err.message);
  }
}

testQuery();
