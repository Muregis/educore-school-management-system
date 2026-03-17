import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// ── GET all books ─────────────────────────────────────────────────────────────
router.get("/books", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { rows } = await pool.query(
      `SELECT * FROM books WHERE school_id=$1 AND is_deleted=false ORDER BY title`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST add book ─────────────────────────────────────────────────────────────
router.post("/books", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, author, category = "General", isbn = null, quantityTotal = 1 } = req.body;
    if (!title || !author) return res.status(400).json({ message: "title and author are required" });

    const qty = Number(quantityTotal) || 1;
    const result = await pool.query(
      `INSERT INTO books (school_id, title, author, category, isbn, quantity_total, quantity_available, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING book_id`,
      [schoolId, title, author, category, isbn, qty, qty]
    );
    // OLD:
    // const [row] = await pool.query(`SELECT * FROM books WHERE book_id=?`, [result.insertId]);
    const { rows } = await pool.query(`SELECT * FROM books WHERE book_id=$1 AND school_id=$2`, [result.rows[0].book_id, schoolId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── PUT update book ───────────────────────────────────────────────────────────
router.put("/books/:id", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, author, category, isbn, quantityTotal } = req.body;
    const { rows } = await pool.query(`SELECT * FROM books WHERE book_id=$1 AND school_id=$2`, [req.params.id, schoolId]);
    if (!rows.length) return res.status(404).json({ message: "Book not found" });

    const book = rows[0];
    const newTotal = Number(quantityTotal) || book.quantity_total;
    const checkedOut = book.quantity_total - book.quantity_available;
    const newAvailable = Math.max(0, newTotal - checkedOut);

    await pool.query(
      `UPDATE books SET title=$1, author=$2, category=$3, isbn=$4, quantity_total=$5, quantity_available=$6, updated_at=CURRENT_TIMESTAMP
       WHERE book_id=$7 AND school_id=$8`,
      [title||book.title, author||book.author, category||book.category, isbn??book.isbn,
       newTotal, newAvailable, req.params.id, schoolId]
    );
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ── DELETE book ───────────────────────────────────────────────────────────────
router.delete("/books/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    await pool.query(`UPDATE books SET is_deleted=true WHERE book_id=$1 AND school_id=$2`, [req.params.id, schoolId]);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── GET all borrow records ────────────────────────────────────────────────────
router.get("/borrows", async (req, res, next) => {
  try {
    const { schoolId, role, userId } = req.user;
    const studentId = req.user.studentId;

    let sql = `
      SELECT br.borrow_id, br.book_id, b.title AS book_title, b.category,
             br.borrower_id, br.borrower_type, br.borrow_date, br.due_date,
             br.return_date, br.status, br.notes,
             CASE WHEN br.borrower_type='student' THEN s.admission_number ELSE t.staff_number END AS borrower_ref
      FROM borrow_records br
      JOIN books b ON b.book_id = br.book_id
      LEFT JOIN students s ON s.student_id = br.borrower_id AND br.borrower_type='student'
      LEFT JOIN teachers t ON t.teacher_id = br.borrower_id AND br.borrower_type='staff'
      WHERE br.school_id=$1 AND br.is_deleted=false`;

    const params = [schoolId];

    // Students only see their own borrows
    if (role === "student" && studentId) {
      sql += " AND br.borrower_type='student' AND br.borrower_id=$2";
      params.push(studentId);
    }

    sql += " ORDER BY br.borrow_date DESC, br.borrow_id DESC";
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST issue book ───────────────────────────────────────────────────────────
router.post("/borrows", requireRoles("admin","librarian","teacher"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { bookId, borrowerId, borrowerType = "student", dueDate, notes = null } = req.body;

    if (!bookId)     return res.status(400).json({ message: "bookId is required" });
    if (!borrowerId) return res.status(400).json({ message: "borrowerId is required" });
    if (!dueDate)    return res.status(400).json({ message: "dueDate is required" });

    // Check book exists and has copies available
    const { rows } = await pool.query(
      `SELECT * FROM books WHERE book_id=$1 AND school_id=$2 AND is_deleted=false LIMIT 1`,
      [bookId, schoolId]
    );
    const books = rows;
    if (!books.length) return res.status(404).json({ message: "Book not found" });
    const book = books[0];
    if (book.quantity_available < 1)
      return res.status(400).json({ message: `No copies available for "${book.title}"` });

    // Verify borrower exists
    if (borrowerType === "student") {
      const { rows } = await pool.query(`SELECT student_id FROM students WHERE student_id=$1 AND school_id=$2 AND is_deleted=false`, [borrowerId, schoolId]);
      if (!rows.length) return res.status(404).json({ message: "Student not found" });
    } else {
      const { rows } = await pool.query(`SELECT teacher_id FROM teachers WHERE teacher_id=$1 AND school_id=$2 AND is_deleted=false`, [borrowerId, schoolId]);
      if (!rows.length) return res.status(404).json({ message: "Staff member not found" });
    }

    // Insert borrow record
    const result = await pool.query(
      `INSERT INTO borrow_records (school_id, book_id, borrower_id, borrower_type, borrow_date, due_date, notes, status, issued_by_user_id)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, 'borrowed', $7)
       RETURNING borrow_id`,
      [schoolId, bookId, borrowerId, borrowerType, dueDate, notes, userId]
    );

    // Decrement available count
    await pool.query(
      `UPDATE books SET quantity_available = quantity_available - 1 WHERE book_id=$1 AND school_id=$2`,
      [bookId, schoolId]
    );

    res.status(201).json({ borrowId: result.rows[0].borrow_id });
  } catch (err) { next(err); }
});

// ── PUT return book ───────────────────────────────────────────────────────────
router.put("/borrows/:id/return", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;

    const { rows } = await pool.query(
      `SELECT * FROM borrow_records WHERE borrow_id=$1 AND school_id=$2 AND is_deleted=false LIMIT 1`,
      [req.params.id, schoolId]
    );
    const records = rows;
    if (!records.length) return res.status(404).json({ message: "Borrow record not found" });
    const record = records[0];
    if (record.status === "returned") return res.status(400).json({ message: "Already returned" });

    // Mark returned
    await pool.query(
      `UPDATE borrow_records SET status='returned', return_date=CURRENT_DATE, returned_to_user_id=$1, updated_at=CURRENT_TIMESTAMP
       WHERE borrow_id=$2 AND school_id=$3`,
      [userId, req.params.id, schoolId]
    );

    // Increment available count
    await pool.query(
      `UPDATE books SET quantity_available = quantity_available + 1 WHERE book_id=$1 AND school_id=$2`,
      [record.book_id, schoolId]
    );

    res.json({ returned: true });
  } catch (err) { next(err); }
});

export default router;
