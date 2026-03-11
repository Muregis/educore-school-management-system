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
    const [rows] = await pool.query(
      `SELECT * FROM books WHERE school_id=? AND is_deleted=0 ORDER BY title`,
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
    const [result] = await pool.query(
      `INSERT INTO books (school_id, title, author, category, isbn, quantity_total, quantity_available, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [schoolId, title, author, category, isbn, qty, qty]
    );
    const [row] = await pool.query(`SELECT * FROM books WHERE book_id=?`, [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) { next(err); }
});

// ── PUT update book ───────────────────────────────────────────────────────────
router.put("/books/:id", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, author, category, isbn, quantityTotal } = req.body;
    const [existing] = await pool.query(`SELECT * FROM books WHERE book_id=? AND school_id=?`, [req.params.id, schoolId]);
    if (!existing.length) return res.status(404).json({ message: "Book not found" });

    const book = existing[0];
    const newTotal = Number(quantityTotal) || book.quantity_total;
    const checkedOut = book.quantity_total - book.quantity_available;
    const newAvailable = Math.max(0, newTotal - checkedOut);

    await pool.query(
      `UPDATE books SET title=?, author=?, category=?, isbn=?, quantity_total=?, quantity_available=?, updated_at=CURRENT_TIMESTAMP
       WHERE book_id=? AND school_id=?`,
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
    await pool.query(`UPDATE books SET is_deleted=1 WHERE book_id=? AND school_id=?`, [req.params.id, schoolId]);
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
             DATEDIFF(CURDATE(), br.borrow_date) AS days_out,
             DATEDIFF(br.due_date, CURDATE()) AS days_remaining,
             CASE
               WHEN br.borrower_type='student' THEN CONCAT(s.first_name,' ',s.last_name)
               WHEN br.borrower_type='staff'   THEN CONCAT(t.first_name,' ',t.last_name)
               ELSE 'Unknown'
             END AS borrower_name,
             CASE WHEN br.borrower_type='student' THEN s.admission_number ELSE t.staff_number END AS borrower_ref
      FROM borrow_records br
      JOIN books b ON b.book_id = br.book_id
      LEFT JOIN students s ON s.student_id = br.borrower_id AND br.borrower_type='student'
      LEFT JOIN teachers t ON t.teacher_id = br.borrower_id AND br.borrower_type='staff'
      WHERE br.school_id=? AND br.is_deleted=0`;

    const params = [schoolId];

    // Students only see their own borrows
    if (role === "student" && studentId) {
      sql += " AND br.borrower_type='student' AND br.borrower_id=?";
      params.push(studentId);
    }

    sql += " ORDER BY br.borrow_date DESC, br.borrow_id DESC";
    const [rows] = await pool.query(sql, params);
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
    const [books] = await pool.query(
      `SELECT * FROM books WHERE book_id=? AND school_id=? AND is_deleted=0 LIMIT 1`,
      [bookId, schoolId]
    );
    if (!books.length) return res.status(404).json({ message: "Book not found" });
    const book = books[0];
    if (book.quantity_available < 1)
      return res.status(400).json({ message: `No copies available for "${book.title}"` });

    // Verify borrower exists
    if (borrowerType === "student") {
      const [s] = await pool.query(`SELECT student_id FROM students WHERE student_id=? AND school_id=? AND is_deleted=0`, [borrowerId, schoolId]);
      if (!s.length) return res.status(404).json({ message: "Student not found" });
    } else {
      const [t] = await pool.query(`SELECT teacher_id FROM teachers WHERE teacher_id=? AND school_id=? AND is_deleted=0`, [borrowerId, schoolId]);
      if (!t.length) return res.status(404).json({ message: "Staff member not found" });
    }

    // Insert borrow record
    const [result] = await pool.query(
      `INSERT INTO borrow_records (school_id, book_id, borrower_id, borrower_type, borrow_date, due_date, notes, status, issued_by_user_id)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 'borrowed', ?)`,
      [schoolId, bookId, borrowerId, borrowerType, dueDate, notes, userId]
    );

    // Decrement available count
    await pool.query(
      `UPDATE books SET quantity_available = quantity_available - 1 WHERE book_id=? AND school_id=?`,
      [bookId, schoolId]
    );

    res.status(201).json({ borrowId: result.insertId });
  } catch (err) { next(err); }
});

// ── PUT return book ───────────────────────────────────────────────────────────
router.put("/borrows/:id/return", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;

    const [records] = await pool.query(
      `SELECT * FROM borrow_records WHERE borrow_id=? AND school_id=? AND is_deleted=0 LIMIT 1`,
      [req.params.id, schoolId]
    );
    if (!records.length) return res.status(404).json({ message: "Borrow record not found" });
    const record = records[0];
    if (record.status === "returned") return res.status(400).json({ message: "Already returned" });

    // Mark returned
    await pool.query(
      `UPDATE borrow_records SET status='returned', return_date=CURDATE(), returned_to_user_id=?, updated_at=CURRENT_TIMESTAMP
       WHERE borrow_id=? AND school_id=?`,
      [userId, req.params.id, schoolId]
    );

    // Increment available count
    await pool.query(
      `UPDATE books SET quantity_available = quantity_available + 1 WHERE book_id=? AND school_id=?`,
      [record.book_id, schoolId]
    );

    res.json({ returned: true });
  } catch (err) { next(err); }
});

export default router;
