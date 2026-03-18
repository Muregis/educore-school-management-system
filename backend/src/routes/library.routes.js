import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// ── GET all books ─────────────────────────────────────────────────────────────
router.get("/books", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: rows, error } = await supabase
      .from("books")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("title");
    if (error) throw error;
    res.json(rows || []);
  } catch (err) { next(err); }
});

// ── POST add book ─────────────────────────────────────────────────────────────
router.post("/books", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, author, category = "General", isbn = null, quantityTotal = 1 } = req.body;
    if (!title || !author) return res.status(400).json({ message: "title and author are required" });

    const qty = Number(quantityTotal) || 1;

    const { data: inserted, error: insertError } = await supabase
      .from('books')
      .insert({
        school_id: schoolId,
        title,
        author,
        category,
        isbn,
        quantity_total: qty,
        quantity_available: qty,
        status: 'active'
      })
      .select('book_id')
      .single();

    if (insertError) throw insertError;

    const { data: row, error: selectError } = await supabase
      .from('books')
      .select('*')
      .eq('book_id', inserted.book_id)
      .eq('school_id', schoolId)
      .single();

    if (selectError) throw selectError;
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── PUT update book ───────────────────────────────────────────────────────────
router.put("/books/:id", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, author, category, isbn, quantityTotal } = req.body;
    const { data: book, error: fetchError } = await supabase
      .from('books')
      .select('*')
      .eq('book_id', req.params.id)
      .eq('school_id', schoolId)
      .single();

    if (fetchError || !book) return res.status(404).json({ message: "Book not found" });

    const newTotal = Number(quantityTotal) || book.quantity_total;
    const checkedOut = book.quantity_total - book.quantity_available;
    const newAvailable = Math.max(0, newTotal - checkedOut);

    const { error: updateError } = await supabase
      .from('books')
      .update({
        title: title || book.title,
        author: author || book.author,
        category: category || book.category,
        isbn: isbn ?? book.isbn,
        quantity_total: newTotal,
        quantity_available: newAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('book_id', req.params.id)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ── DELETE book ───────────────────────────────────────────────────────────────
router.delete("/books/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error: updateError } = await supabase
      .from('books')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('book_id', req.params.id)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;
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

    // Supabase-native query (no raw SQL / no $1 placeholders)
    let q = supabase
      .from("borrow_records")
      .select("borrow_id, book_id, borrower_id, borrower_type, borrow_date, due_date, return_date, status, notes")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("borrow_date", { ascending: false })
      .order("borrow_id", { ascending: false });

    if (role === "student" && studentId) {
      q = q.eq("borrower_type", "student").eq("borrower_id", studentId);
    }

    const { data: borrows, error: bErr } = await q;
    if (bErr) throw bErr;

    const bookIds = Array.from(new Set((borrows || []).map(r => r.book_id).filter(Boolean)));
    const borrowerIds = Array.from(new Set((borrows || []).map(r => r.borrower_id).filter(Boolean)));

    const [{ data: books, error: booksErr }, { data: students, error: stuErr }, { data: teachers, error: teaErr }] =
      await Promise.all([
        bookIds.length
          ? supabase.from("books").select("book_id, title, category").eq("school_id", schoolId).in("book_id", bookIds)
          : Promise.resolve({ data: [], error: null }),
        borrowerIds.length
          ? supabase.from("students").select("student_id, admission_number").eq("school_id", schoolId).in("student_id", borrowerIds)
          : Promise.resolve({ data: [], error: null }),
        borrowerIds.length
          ? supabase.from("teachers").select("teacher_id, staff_number").eq("school_id", schoolId).in("teacher_id", borrowerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (booksErr) throw booksErr;
    if (stuErr) throw stuErr;
    if (teaErr) throw teaErr;

    const bookMap = new Map((books || []).map(b => [String(b.book_id), { title: b.title, category: b.category }]));
    const studentMap = new Map((students || []).map(s => [String(s.student_id), s.admission_number]));
    const teacherMap = new Map((teachers || []).map(t => [String(t.teacher_id), t.staff_number]));

    const rows = (borrows || []).map(br => {
      const book = bookMap.get(String(br.book_id));
      return {
        borrow_id: br.borrow_id,
        book_id: br.book_id,
        book_title: book?.title ?? null,
        category: book?.category ?? null,
        borrower_id: br.borrower_id,
        borrower_type: br.borrower_type,
        borrow_date: br.borrow_date,
        due_date: br.due_date,
        return_date: br.return_date,
        status: br.status,
        notes: br.notes,
        borrower_ref:
          br.borrower_type === "student"
            ? studentMap.get(String(br.borrower_id)) ?? null
            : teacherMap.get(String(br.borrower_id)) ?? null,
      };
    });

    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET all borrow records (alias for frontend compatibility) ───────────────────
router.get("/borrow-records", async (req, res, next) => {
  // Forward to the existing borrows endpoint
  req.url = req.url.replace('/borrow-records', '/borrows');
  return req.app._router.handle(req, res, next);
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
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('book_id', bookId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (bookError || !book) return res.status(404).json({ message: "Book not found" });
    if (book.quantity_available < 1)
      return res.status(400).json({ message: `No copies available for "${book.title}"` });

    // Verify borrower exists
    if (borrowerType === "student") {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('student_id', borrowerId)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .single();
      if (studentError || !student) return res.status(404).json({ message: "Student not found" });
    } else {
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('teacher_id')
        .eq('teacher_id', borrowerId)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .single();
      if (teacherError || !teacher) return res.status(404).json({ message: "Staff member not found" });
    }

    // Insert borrow record
    const { data: inserted, error: insertError } = await supabase
      .from('borrow_records')
      .insert({
        school_id: schoolId,
        book_id: bookId,
        borrower_id: borrowerId,
        borrower_type: borrowerType,
        borrow_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate,
        notes,
        status: 'borrowed',
        issued_by_user_id: userId
      })
      .select('borrow_id')
      .single();

    if (insertError) throw insertError;

    // Decrement available count
    const { error: updateError } = await supabase
      .from('books')
      .update({ quantity_available: book.quantity_available - 1 })
      .eq('book_id', bookId)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;

    res.status(201).json({ borrowId: inserted.borrow_id });
  } catch (err) { next(err); }
});

// ── PUT return book ───────────────────────────────────────────────────────────
router.put("/borrows/:id/return", requireRoles("admin","librarian"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;

    const { data: record, error: fetchError } = await supabase
      .from('borrow_records')
      .select('*')
      .eq('borrow_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !record) return res.status(404).json({ message: "Borrow record not found" });
    if (record.status === "returned") return res.status(400).json({ message: "Already returned" });

    // Mark returned
    const { error: updateError } = await supabase
      .from('borrow_records')
      .update({
        status: 'returned',
        return_date: new Date().toISOString().slice(0, 10),
        returned_to_user_id: userId,
        updated_at: new Date().toISOString()
      })
      .eq('borrow_id', req.params.id)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;

    // Increment available count
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('quantity_available')
      .eq('book_id', record.book_id)
      .eq('school_id', schoolId)
      .single();

    if (bookError) throw bookError;

    const { error: bookUpdateError } = await supabase
      .from('books')
      .update({ quantity_available: book.quantity_available + 1 })
      .eq('book_id', record.book_id)
      .eq('school_id', schoolId);

    if (bookUpdateError) throw bookUpdateError;

    res.json({ returned: true });
  } catch (err) { next(err); }
});

export default router;
