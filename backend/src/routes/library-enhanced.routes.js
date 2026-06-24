import { Router } from "express";
import { LibraryService } from "../core/services/LibraryService.js";

const router = Router();
const libraryService = new LibraryService();

// Add book copy
router.post("/copies", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await libraryService.addBookCopy(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('LIBRARY_ERROR', error.message, {}, 400);
  }
});

// Borrow book
router.post("/circulation/borrow", async (req, res) => {
  try {
    const { book_copy_id, student_id, due_date } = req.body;
    const result = await libraryService.borrowBook(book_copy_id, student_id, due_date, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('LIBRARY_ERROR', error.message, {}, 400);
  }
});

// Return book
router.post("/circulation/:circulationId/return", async (req, res) => {
  try {
    const { circulationId } = req.params;
    const result = await libraryService.returnBook(circulationId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('LIBRARY_ERROR', error.message, {}, 400);
  }
});

// Reserve book
router.post("/reservations", async (req, res) => {
  try {
    const { book_id, student_id } = req.body;
    const result = await libraryService.reserveBook(book_id, student_id, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('LIBRARY_ERROR', error.message, {}, 400);
  }
});

// Get overdue books
router.get("/circulation/overdue", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await libraryService.getOverdueBooks(schoolId);
    res.success(result);
  } catch (error) {
    res.error('LIBRARY_ERROR', error.message, {}, 500);
  }
});

// Get student borrowed books
router.get("/circulation/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await libraryService.getStudentBorrowedBooks(studentId);
    res.success(result);
  } catch (error) {
    res.error('LIBRARY_ERROR', error.message, {}, 500);
  }
});

export default router;
