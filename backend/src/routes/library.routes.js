import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

function applyBookIdentityFilter(query, rawId) {
  const id = String(rawId);
  return query.or(`book_id.eq.${id},id.eq.${id}`);
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return Boolean(error) && (
    error.code === "PGRST204" ||
    message.includes("column") ||
    message.includes("schema cache")
  );
}

function normalizeBookRow(row = {}) {
  const total = Number(row.quantity_total ?? row.quantity ?? 1) || 1;
  const available = Number(row.quantity_available ?? total) || total;
  return {
    ...row,
    book_id: row.book_id ?? row.id,
    quantity_total: total,
    quantity_available: available,
    category: row.category || "General",
    isbn: row.isbn || null,
  };
}

// ── GET all books ─────────────────────────────────────────────────────────────
// Now uses library_books table with book codes
router.get("/books", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: books, error } = await supabase
      .from("library_books")
      .select(`
        book_id, book_code, title, author, isbn,
        category, publisher, publication_year,
        shelf_location, total_copies, available_copies,
        copies:library_book_copies(
          copy_id, copy_code, copy_number,
          status, condition, is_lost
        )
      `)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("book_code");

    if (error) throw error;

    // Transform to legacy format for frontend compatibility
    const transformed = (books || []).map(b => ({
      book_id: b.book_id,
      id: b.book_id,
      book_code: b.book_code,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      category: b.category,
      quantity_total: b.total_copies,
      quantity_available: b.available_copies,
      copies: b.copies,
      status: b.available_copies > 0 ? 'active' : 'unavailable'
    }));

    res.json(transformed);
  } catch (err) { next(err); }
});

// ── POST add book ─────────────────────────────────────────────────────────────
// This now uses the library_books table with auto-generated book codes
router.post("/books", requireRoles("admin","librarian","director","superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { title, author, category = "General", isbn = null, quantityTotal = 1 } = req.body;
    if (!title || !author) return res.status(400).json({ message: "title and author are required" });

    const qty = Number(quantityTotal) || 1;

    // Generate book code automatically
    const year = new Date().getFullYear();
    const { data: school } = await supabase
      .from('schools')
      .select('library_shortcode, code')
      .eq('school_id', schoolId)
      .single();
    const shortcode = school?.library_shortcode || school?.code?.substring(0, 6) || 'LIB';

    // Get next sequence
    const { data: seqNum, error: seqError } = await supabase
      .rpc('get_next_book_sequence', { p_school_id: schoolId, p_year: year });
    if (seqError) throw seqError;

    const bookCode = `${shortcode}/${String(seqNum).padStart(3, '0')}/${year}`;

    // Insert book into library_books
    const { data: book, error: bookError } = await supabase
      .from('library_books')
      .insert({
        school_id: schoolId,
        title,
        author,
        category,
        isbn,
        total_copies: qty,
        available_copies: qty,
        book_code: bookCode,
        sequence_number: seqNum,
        year_added: year,
        added_by: userId
      })
      .select('book_id, book_code, title, author, isbn, category, total_copies, available_copies')
      .single();

    if (bookError) throw bookError;

    // Generate copy codes
    const copies = [];
    for (let i = 1; i <= qty; i++) {
      copies.push({
        school_id: schoolId,
        book_id: book.book_id,
        copy_number: i,
        copy_code: `${bookCode}-C${i}`,
        qr_data: `${bookCode}-C${i}`,
        status: 'available',
        condition: 'good'
      });
    }

    const { data: bookCopies, error: copyError } = await supabase
      .from('library_book_copies')
      .insert(copies)
      .select('copy_id, copy_code, copy_number, status');

    if (copyError) throw copyError;

    res.status(201).json({
      book_id: book.book_id,
      book_code: book.book_code,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      quantity_total: book.total_copies,
      quantity_available: book.available_copies,
      copies: bookCopies,
      message: `Book added — Code: ${bookCode} — ${qty} copies created`
    });
  } catch (err) { next(err); }
});

// ── PUT update book ───────────────────────────────────────────────────────────
router.put("/books/:id", requireRoles("admin","librarian","director","superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, author, category, isbn, quantityTotal } = req.body;
    const { data: book, error: fetchError } = await supabase
      .from('library_books')
      .select('*')
      .eq('school_id', schoolId)
      .eq('book_id', req.params.id)
      .single();

    if (fetchError || !book) return res.status(404).json({ message: "Book not found" });

    const newTotal = Number(quantityTotal) || book.total_copies;
    const checkedOut = book.total_copies - book.available_copies;
    const newAvailable = Math.max(0, newTotal - checkedOut);

    const { error: updateError } = await supabase
      .from('library_books')
      .update({
        title: title || book.title,
        author: author || book.author,
        category: category || book.category,
        isbn: isbn ?? book.isbn,
        total_copies: newTotal,
        available_copies: newAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('school_id', schoolId)
      .eq('book_id', req.params.id);

    if (updateError) throw updateError;
    res.json({ updated: true, book_id: book.book_id });
  } catch (err) { next(err); }
});

// ── DELETE book ───────────────────────────────────────────────────────────────
router.delete("/books/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error: updateError } = await supabase
      .from('library_books')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('book_id', req.params.id);

    if (updateError) throw updateError;
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── GET all borrow records ────────────────────────────────────────────────────
router.get("/borrows", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const studentId = req.user.studentId;

    const fetchLegacyBorrows = async () => {
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

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    };

    const fetchLibraryBorrowings = async () => {
      let q = supabase
        .from("library_borrowings")
        .select("borrowing_id, book_id, student_id, borrowed_date, due_date, returned_date, status, notes")
        .eq("school_id", schoolId)
        .eq("is_deleted", false)
        .order("borrowed_date", { ascending: false })
        .order("borrowing_id", { ascending: false });

      if (role === "student" && studentId) {
        q = q.eq("student_id", studentId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    };

    let borrows = [];
    let legacyMode = false;

    try {
      borrows = await fetchLibraryBorrowings();
    } catch (err) {
      console.warn("[LIBRARY] library_borrowings query failed, falling back to borrow_records", err.message || err);
      legacyMode = true;
      borrows = await fetchLegacyBorrows();
    }

    const bookIds = Array.from(new Set((borrows || []).map(r => r.book_id).filter(Boolean)));
    const borrowerIds = Array.from(new Set((borrows || []).map(r => legacyMode ? r.borrower_id : r.student_id).filter(Boolean)));

    const [{ data: books, error: booksErr }, { data: students, error: stuErr }, { data: teachers, error: teaErr }] =
      await Promise.all([
        bookIds.length
          ? supabase.from("library_books").select("book_id, title, category").eq("school_id", schoolId).in("book_id", bookIds)
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
      const borrowerType = legacyMode ? br.borrower_type : "student";
      const borrowerId = legacyMode ? br.borrower_id : br.student_id;
      const borrowDate = legacyMode ? br.borrow_date : br.borrowed_date;
      const returnDate = legacyMode ? br.return_date : br.returned_date;
      const borrowId = legacyMode ? br.borrow_id : br.borrowing_id;
      const book = bookMap.get(String(br.book_id));
      return {
        borrow_id: borrowId,
        book_id: br.book_id,
        book_title: book?.title ?? null,
        category: book?.category ?? null,
        borrower_id: borrowerId,
        borrower_type: borrowerType,
        borrow_date: borrowDate,
        due_date: br.due_date,
        return_date: returnDate,
        status: br.status,
        notes: br.notes,
        borrower_ref:
          borrowerType === "student"
            ? studentMap.get(String(borrowerId)) ?? null
            : teacherMap.get(String(borrowerId)) ?? null,
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
router.post("/borrows", requireRoles("admin","librarian","director","superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { bookId, borrowerId, borrowerType = "student", dueDate, notes = null } = req.body;

    if (!bookId)     return res.status(400).json({ message: "bookId is required" });
    if (!borrowerId) return res.status(400).json({ message: "borrowerId is required" });
    if (!dueDate)    return res.status(400).json({ message: "dueDate is required" });

    const { data: book, error: bookError } = await supabase
      .from('library_books')
      .select('*')
      .eq('book_id', bookId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (bookError || !book) return res.status(404).json({ message: "Book not found" });
    if (book.available_copies < 1)
      return res.status(400).json({ message: `No copies available for "${book.title}"` });

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

    let inserted;

    if (borrowerType === "student") {
      const { data, error } = await supabase
        .from('library_borrowings')
        .insert({
          school_id: schoolId,
          book_id: bookId,
          student_id: borrowerId,
          borrowed_date: new Date().toISOString().slice(0, 10),
          due_date: dueDate,
          notes,
          status: 'borrowed'
        })
        .select('borrowing_id')
        .single();

      if (!error && data) {
        inserted = data;
      }
    }

    if (!inserted) {
      const { data, error } = await supabase
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

      if (error) throw error;
      inserted = data;
    }

    const { error: updateError } = await supabase
      .from('library_books')
      .update({ available_copies: book.available_copies - 1 })
      .eq('book_id', bookId)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;

    res.status(201).json({ borrowId: inserted?.borrowing_id || inserted?.borrow_id });
  } catch (err) { next(err); }
});

// ── PUT return book ───────────────────────────────────────────────────────────
router.put("/borrows/:id/return", requireRoles("admin","librarian","director","superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const borrowId = req.params.id;

    let record;
    let isLegacy = false;

    const { data: libRecord, error: libError } = await supabase
      .from('library_borrowings')
      .select('*')
      .eq('borrowing_id', borrowId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (!libError && libRecord) {
      record = libRecord;
    } else {
      const { data: legacyRecord, error: legacyError } = await supabase
        .from('borrow_records')
        .select('*')
        .eq('borrow_id', borrowId)
        .eq('school_id', schoolId)
        .eq('is_deleted', false)
        .single();
      if (legacyError || !legacyRecord) return res.status(404).json({ message: "Borrow record not found" });
      record = legacyRecord;
      isLegacy = true;
    }

    if (record.status === "returned") return res.status(400).json({ message: "Already returned" });

    if (isLegacy) {
      const { error: updateError } = await supabase
        .from('borrow_records')
        .update({
          status: 'returned',
          return_date: new Date().toISOString().slice(0, 10),
          returned_to_user_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('borrow_id', borrowId)
        .eq('school_id', schoolId);

      if (updateError) throw updateError;
    } else {
      const { error: updateError } = await supabase
        .from('library_borrowings')
        .update({
          status: 'returned',
          returned_date: new Date().toISOString().slice(0, 10)
        })
        .eq('borrowing_id', borrowId)
        .eq('school_id', schoolId);

      if (updateError) throw updateError;
    }

    const bookId = record.book_id;
    const { data: book, error: bookError } = await supabase
      .from('library_books')
      .select('available_copies')
      .eq('book_id', bookId)
      .eq('school_id', schoolId)
      .single();

    if (bookError) throw bookError;

    const { error: bookUpdateError } = await supabase
      .from('library_books')
      .update({ available_copies: book.available_copies + 1 })
      .eq('book_id', bookId)
      .eq('school_id', schoolId);

    if (bookUpdateError) throw bookUpdateError;

    res.json({ returned: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW LIBRARY BOOK CODE SYSTEM ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: Generate book code
async function generateBookCode(schoolId, supabase) {
  const year = new Date().getFullYear();
  
  // Get school shortcode
  const { data: school } = await supabase
    .from('schools')
    .select('library_shortcode, code')
    .eq('school_id', schoolId)
    .single();

  const shortcode = school?.library_shortcode || 
                    school?.code?.substring(0, 6) || 
                    'LIB';

  // Get next sequence atomically
  const { data: seqNum, error: seqError } = await supabase
    .rpc('get_next_book_sequence', {
      p_school_id: schoolId,
      p_year: year
    });

  if (seqError) throw seqError;

  const sequence = String(seqNum).padStart(3, '0');
  const bookCode = `${shortcode}/${sequence}/${year}`;

  return { bookCode, sequenceNumber: seqNum, year };
}

// Helper: Generate copy code
function generateCopyCode(bookCode, copyNumber, isReplacement = false) {
  return isReplacement 
    ? `${bookCode}-C${copyNumber}R` 
    : `${bookCode}-C${copyNumber}`;
}

// GET /api/library/next-code — Preview next auto-generated code
router.get('/next-code', authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const generated = await generateBookCode(schoolId, supabase);
    res.json({
      preview: generated.bookCode,
      shortcode: generated.bookCode.split('/')[0],
      sequence: generated.sequenceNumber,
      year: generated.year
    });
  } catch (err) { next(err); }
});

// POST /api/library/books-coded — Add book with auto or manual code
router.post('/books-coded', authRequired,
  requireRoles('admin', 'librarian'),
  async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const {
      title,
      author,
      isbn,
      category,
      publisher,
      publicationYear,
      numberOfCopies = 1,
      shelfLocation,
      description,
      existingCode,
      useExistingCode = false
    } = req.body;

    if (!title) {
      return res.status(400).json({ 
        message: 'Book title is required' 
      });
    }

    let bookCode, sequenceNumber, year;

    if (useExistingCode && existingCode) {
      // Use the school's existing code exactly as provided
      const parts = existingCode.toUpperCase().split('/');
      if (parts.length !== 3) {
        return res.status(400).json({
          message: 'Invalid code format. Use: SHORTCODE/NUMBER/YEAR (e.g. DIC/020/2026)'
        });
      }
      bookCode = existingCode.toUpperCase();
      sequenceNumber = parseInt(parts[1]);
      year = parseInt(parts[2]);

      // Check not already used
      const { data: existing } = await supabase
        .from('library_books')
        .select('book_id')
        .eq('book_code', bookCode)
        .eq('school_id', schoolId)
        .single();

      if (existing) {
        return res.status(400).json({
          message: `Code ${bookCode} already exists in your library` 
        });
      }
    } else {
      // Auto generate next code
      const generated = await generateBookCode(schoolId, supabase);
      bookCode = generated.bookCode;
      sequenceNumber = generated.sequenceNumber;
      year = generated.year;
    }

    // Insert book
    const { data: book, error: bookError } = await supabase
      .from('library_books')
      .insert({
        school_id: schoolId,
        title,
        author: author || null,
        isbn: isbn || null,
        category: category || null,
        publisher: publisher || null,
        publication_year: publicationYear || null,
        total_copies: parseInt(numberOfCopies),
        available_copies: parseInt(numberOfCopies),
        shelf_location: shelfLocation || null,
        book_code: bookCode,
        sequence_number: sequenceNumber,
        year_added: year,
        added_by: userId
      })
      .select('book_id, book_code, title, isbn, author, category, total_copies')
      .single();

    if (bookError) throw bookError;

    // Generate copy codes for each physical book
    const copies = [];
    for (let i = 1; i <= parseInt(numberOfCopies); i++) {
      copies.push({
        school_id: schoolId,
        book_id: book.book_id,
        copy_number: i,
        copy_code: generateCopyCode(bookCode, i),
        qr_data: generateCopyCode(bookCode, i),
        status: 'available',
        condition: 'good'
      });
    }

    const { data: bookCopies, error: copyError } = await supabase
      .from('library_book_copies')
      .insert(copies)
      .select('copy_id, copy_code, copy_number, status');

    if (copyError) throw copyError;

    res.status(201).json({
      success: true,
      book: { ...book, copies: bookCopies },
      message: `${useExistingCode ? 'Existing' : 'New'} book added — Code: ${bookCode} — ${numberOfCopies} copies created` 
    });

  } catch (err) { next(err); }
});

// GET /api/library/copies/lookup/:code — Look up by any code format
router.get('/copies/lookup/:code', authRequired,
  async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const code = req.params.code.toUpperCase();

    // Try exact copy code first
    let { data: copy } = await supabase
      .from('library_book_copies')
      .select(`
        copy_id, copy_code, copy_number,
        status, condition, is_lost,
        replacement_status,
        book:library_books!inner(
          book_id, title, author, 
          isbn, book_code, category
        )
      `)
      .eq('copy_code', code)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (copy) return res.json({ type: 'copy', data: copy });

    // Try book code — return all copies
    let { data: book } = await supabase
      .from('library_books')
      .select(`
        book_id, title, author, isbn,
        book_code, total_copies, available_copies,
        copies:library_book_copies(
          copy_id, copy_code, copy_number,
          status, condition, is_lost
        )
      `)
      .eq('book_code', code)
      .eq('school_id', schoolId)
      .single();

    if (book) return res.json({ type: 'book', data: book });

    return res.status(404).json({
      message: `No book found with code: ${code}`,
      hint: 'Format should be: DIC/020/2026 or DIC/020/2026-C1'
    });

  } catch (err) { next(err); }
});

// GET /api/library/books-coded — List all books with codes
router.get('/books-coded', authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const { data: books, error } = await supabase
      .from('library_books')
      .select(`
        book_id, book_code, title, author, isbn,
        category, publisher, publication_year,
        shelf_location, total_copies, available_copies,
        copies:library_book_copies(
          copy_id, copy_code, copy_number,
          status, condition, is_lost
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('book_code');

    if (error) throw error;
    res.json(books || []);
  } catch (err) { next(err); }
});

// POST /api/library/copies/verify-replacement — Verify replacement book ISBN
router.post('/copies/verify-replacement', authRequired,
  requireRoles('admin', 'librarian'),
  async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { lostCopyId, replacementIsbn, studentId } = req.body;

    // Get lost copy details
    const { data: lost, error: lostError } = await supabase
      .from('library_book_copies')
      .select(`
        copy_id, copy_code, copy_number,
        book:library_books!inner(
          book_id, title, isbn, book_code
        )
      `)
      .eq('copy_id', lostCopyId)
      .eq('school_id', schoolId)
      .single();

    if (lostError || !lost) {
      return res.status(404).json({ 
        message: 'Lost book record not found' 
      });
    }

    const requiredIsbn = lost.book?.isbn;

    // Strict ISBN check if book has one
    if (requiredIsbn) {
      const isbnMatch = replacementIsbn?.trim() === requiredIsbn?.trim();
      
      if (!isbnMatch) {
        return res.status(400).json({
          verified: false,
          message: 'This is NOT the correct book.',
          required: {
            title: lost.book.title,
            isbn: requiredIsbn,
            bookCode: lost.book.book_code,
            copyCode: lost.copy_code
          },
          provided: { isbn: replacementIsbn },
          instruction: `Student must bring: "${lost.book.title}" with ISBN ${requiredIsbn}` 
        });
      }
    }

    // ISBN matches or no ISBN — accept replacement
    const replacementCopyCode = generateCopyCode(
      lost.book.book_code,
      lost.copy_number,
      true // isReplacement = true → adds R suffix
    );

    // Add replacement as new copy
    const { data: newCopy, error: newCopyError } = await supabase
      .from('library_book_copies')
      .insert({
        school_id: schoolId,
        book_id: lost.book.book_id,
        copy_number: lost.copy_number,
        copy_code: replacementCopyCode,
        qr_data: replacementCopyCode,
        status: 'available',
        condition: 'good'
      })
      .select('copy_id, copy_code')
      .single();

    if (newCopyError) throw newCopyError;

    // Close the borrowing
    await supabase
      .from('library_borrowings')
      .update({
        status: 'returned',
        returned_date: new Date().toISOString().split('T')[0],
        replacement_status: 'accepted',
        return_condition: 'replaced',
        updated_at: new Date().toISOString()
      })
      .eq('copy_id', lostCopyId)
      .eq('student_id', studentId);

    // Mark lost copy as replaced
    await supabase
      .from('library_book_copies')
      .update({
        replacement_status: 'accepted',
        replacement_accepted_at: new Date().toISOString(),
        replacement_accepted_by: userId
      })
      .eq('copy_id', lostCopyId);

    res.json({
      verified: true,
      success: true,
      oldCopyCode: lost.copy_code,
      newCopyCode: newCopy.copy_code,
      message: `Replacement accepted. Old: ${lost.copy_code} → New: ${replacementCopyCode}. Print new QR label.` 
    });

  } catch (err) { next(err); }
});

// GET /api/library/settings — Get library shortcode settings
router.get('/settings', authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const { data: school, error } = await supabase
      .from('schools')
      .select('library_shortcode, library_year_sequence, code')
      .eq('school_id', schoolId)
      .single();

    if (error) throw error;

    const year = new Date().getFullYear();
    const yearSeq = school?.library_year_sequence?.[year] || 0;
    const shortcode = school?.library_shortcode || school?.code?.substring(0, 6) || 'LIB';

    res.json({
      shortcode: shortcode,
      year: year,
      booksAddedThisYear: yearSeq,
      nextAutoCode: `${shortcode}/${String(yearSeq + 1).padStart(3, '0')}/${year}`,
      library_year_sequence: school?.library_year_sequence || {}
    });
  } catch (err) { next(err); }
});

// PUT /api/library/settings — Update library shortcode
router.put('/settings', authRequired,
  requireRoles('admin', 'director', 'superadmin'),
  async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { libraryShortcode } = req.body;

    if (!libraryShortcode || libraryShortcode.length < 2 || libraryShortcode.length > 20) {
      return res.status(400).json({
        message: 'Shortcode must be 2-20 characters'
      });
    }

    const { data, error } = await supabase
      .from('schools')
      .update({ library_shortcode: libraryShortcode.toUpperCase() })
      .eq('school_id', schoolId)
      .select('library_shortcode')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      shortcode: data.library_shortcode,
      message: `Library shortcode updated to: ${data.library_shortcode}`
    });
  } catch (err) { next(err); }
});

export default router;
