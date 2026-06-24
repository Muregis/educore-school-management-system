import { BaseRepository } from '../BaseRepository.js';

/**
 * Book Copies Repository
 */
export class BookCopiesRepository extends BaseRepository {
  constructor() {
    super('book_copies');
  }

  async findByBook(bookId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('book_id', bookId)
      .order('copy_number');
    
    if (error) throw error;
    return data || [];
  }

  async findByBarcode(schoolId, barcode) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, books(*)')
      .eq('school_id', schoolId)
      .eq('barcode', barcode)
      .single();
    
    if (error) throw error;
    return data;
  }

  async findAvailable(schoolId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, books(*)')
      .eq('school_id', schoolId)
      .eq('status', 'available');
    
    if (error) throw error;
    return data || [];
  }
}

/**
 * Book Circulation Repository
 */
export class BookCirculationRepository extends BaseRepository {
  constructor() {
    super('book_circulation');
  }

  async findByStudent(studentId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, book_copies(*, books(*))')
      .eq('student_id', studentId)
      .order('borrow_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async findOverdue(schoolId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, book_copies(*, books(*)), students(*)')
      .eq('school_id', schoolId)
      .lt('due_date', new Date().toISOString().split('T')[0])
      .eq('status', 'borrowed');
    
    if (error) throw error;
    return data || [];
  }

  async returnBook(circulationId, returnDate) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({
        return_date: returnDate,
        status: 'returned'
      })
      .eq('id', circulationId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Book Reservations Repository
 */
export class BookReservationsRepository extends BaseRepository {
  constructor() {
    super('book_reservations');
  }

  async findByStudent(studentId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, books(*)')
      .eq('student_id', studentId)
      .order('reservation_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async findByBook(bookId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, students(*)')
      .eq('book_id', bookId)
      .eq('status', 'pending')
      .order('reservation_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
}
