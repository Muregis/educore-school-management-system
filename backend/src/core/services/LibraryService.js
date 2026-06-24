import { BookCopiesRepository, BookCirculationRepository, BookReservationsRepository } from '../repositories/LibraryRepository.js';
import { BaseRepository } from '../BaseRepository.js';

/**
 * Library Service
 * Implements enterprise library management
 */
export class LibraryService {
  constructor() {
    this.bookCopiesRepository = new BookCopiesRepository();
    this.bookCirculationRepository = new BookCirculationRepository();
    this.bookReservationsRepository = new BookReservationsRepository();
    this.booksRepository = new BaseRepository('books');
  }

  /**
   * Add book copy
   */
  async addBookCopy(data, context = {}) {
    const copy = await this.bookCopiesRepository.create(data, context);
    
    // Update book copy counts
    await this.updateBookCopyCounts(data.book_id);
    
    return copy;
  }

  /**
   * Borrow book
   */
  async borrowBook(bookCopyId, studentId, dueDate, context = {}) {
    const copy = await this.bookCopiesRepository.findById(bookCopyId);
    if (!copy) {
      throw new Error('Book copy not found');
    }

    if (copy.status !== 'available') {
      throw new Error('Book copy is not available');
    }

    // Create circulation record
    const circulation = await this.bookCirculationRepository.create({
      book_copy_id: bookCopyId,
      school_id: copy.school_id,
      student_id: studentId,
      borrow_date: new Date().toISOString().split('T')[0],
      due_date: dueDate,
      status: 'borrowed'
    }, context);

    // Update copy status
    await this.bookCopiesRepository.update(bookCopyId, { status: 'borrowed' }, context);
    
    // Update book copy counts
    await this.updateBookCopyCounts(copy.book_id);

    return circulation;
  }

  /**
   * Return book
   */
  async returnBook(circulationId, context = {}) {
    const circulation = await this.bookCirculationRepository.findById(circulationId);
    if (!circulation) {
      throw new Error('Circulation record not found');
    }

    const returnDate = new Date().toISOString().split('T')[0];
    
    // Calculate fine if overdue
    let fineAmount = 0;
    if (new Date(returnDate) > new Date(circulation.due_date)) {
      const daysOverdue = Math.ceil((new Date(returnDate) - new Date(circulation.due_date)) / (1000 * 60 * 60 * 24));
      fineAmount = daysOverdue * 10; // 10 per day
    }

    // Update circulation
    const updated = await this.bookCirculationRepository.update(circulationId, {
      return_date: returnDate,
      status: fineAmount > 0 ? 'overdue' : 'returned',
      fine_amount: fineAmount
    }, context);

    // Update copy status
    await this.bookCopiesRepository.update(circulation.book_copy_id, { status: 'available' }, context);
    
    // Update book copy counts
    await this.updateBookCopyCounts((await this.bookCopiesRepository.findById(circulation.book_copy_id)).book_id);

    return updated;
  }

  /**
   * Reserve book
   */
  async reserveBook(bookId, studentId, context = {}) {
    const book = await this.booksRepository.findById(bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    // Check if student already has active reservation
    const existing = await this.bookReservationsRepository.findAll({
      book_id: bookId,
      student_id: studentId,
      status: 'pending'
    });

    if (existing.data?.length > 0) {
      throw new Error('Student already has an active reservation for this book');
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

    return await this.bookReservationsRepository.create({
      book_id: bookId,
      school_id: book.school_id,
      student_id: studentId,
      expiry_date: expiryDate.toISOString().split('T')[0],
      status: 'pending'
    }, context);
  }

  /**
   * Get overdue books
   */
  async getOverdueBooks(schoolId) {
    return await this.bookCirculationRepository.findOverdue(schoolId);
  }

  /**
   * Get student borrowed books
   */
  async getStudentBorrowedBooks(studentId) {
    return await this.bookCirculationRepository.findByStudent(studentId);
  }

  /**
   * Update book copy counts
   */
  async updateBookCopyCounts(bookId) {
    const copies = await this.bookCopiesRepository.findByBook(bookId);
    const totalCopies = copies.length;
    const availableCopies = copies.filter(c => c.status === 'available').length;

    await this.booksRepository.update(bookId, {
      total_copies: totalCopies,
      available_copies: availableCopies
    });
  }
}
