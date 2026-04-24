/**
 * OfflineDatabase Service
 * Manages IndexedDB storage for offline-first functionality
 * Critical for Kenyan schools with unreliable internet
 */

const DB_NAME = 'educore_offline_v1';
const DB_VERSION = 1;

class OfflineDatabase {
  constructor() {
    this.db = null;
    this.dbPromise = null;
  }

  /**
   * Initialize the IndexedDB database
   */
  async init() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store 1: Cached student data
        if (!db.objectStoreNames.contains('students')) {
          const studentStore = db.createObjectStore('students', {
            keyPath: 'student_id'
          });
          studentStore.createIndex('class_id', 'class_id', { unique: false });
          studentStore.createIndex('admission_number', 'admission_number', { unique: false });
          studentStore.createIndex('status', 'status', { unique: false });
        }

        // Store 2: Cached class data
        if (!db.objectStoreNames.contains('classes')) {
          const classStore = db.createObjectStore('classes', {
            keyPath: 'class_id'
          });
          classStore.createIndex('academic_year', 'academic_year', { unique: false });
        }

        // Store 3: Cached subject data
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', {
            keyPath: 'subject_id'
          });
        }

        // Store 4: Pending actions queue (attendance, grades)
        if (!db.objectStoreNames.contains('pending_actions')) {
          const actionStore = db.createObjectStore('pending_actions', {
            keyPath: 'local_id',
            autoIncrement: true
          });
          actionStore.createIndex('status', 'status', { unique: false });
          actionStore.createIndex('type', 'type', { unique: false });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionStore.createIndex('student_id', 'student_id', { unique: false });
        }

        // Store 5: Sync metadata
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', {
            keyPath: 'key'
          });
        }

        // Store 6: Cached attendance (for quick lookup)
        if (!db.objectStoreNames.contains('cached_attendance')) {
          const attendanceStore = db.createObjectStore('cached_attendance', {
            keyPath: 'cache_key' // composite: student_id + date
          });
          attendanceStore.createIndex('date', 'attendance_date', { unique: false });
          attendanceStore.createIndex('class_id', 'class_id', { unique: false });
        }

        // Store 7: Cached grades
        if (!db.objectStoreNames.contains('cached_grades')) {
          const gradesStore = db.createObjectStore('cached_grades', {
            keyPath: 'cache_key' // composite: student_id + subject + term
          });
          gradesStore.createIndex('student_id', 'student_id', { unique: false });
          gradesStore.createIndex('term', 'term', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Cache students data locally
   */
  async cacheStudents(students) {
    const db = await this.init();
    const tx = db.transaction('students', 'readwrite');
    const store = tx.objectStore('students');

    const timestamp = new Date().toISOString();

    for (const student of students) {
      await store.put({
        ...student,
        _cached_at: timestamp,
        _version: 1
      });
    }

    // Update sync metadata
    await this.setSyncMetadata('students_last_cache', timestamp);

    return students.length;
  }

  /**
   * Get cached student by ID
   */
  async getStudent(studentId) {
    const db = await this.init();
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');
    return await store.get(studentId);
  }

  /**
   * Get all cached students for a class
   */
  async getStudentsByClass(classId) {
    const db = await this.init();
    const tx = db.transaction('students', 'readonly');
    const index = tx.objectStore('students').index('class_id');
    return await index.getAll(classId);
  }

  /**
   * Search cached students by name or admission number
   */
  async searchStudents(query) {
    const db = await this.init();
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');

    const allStudents = await store.getAll();
    const lowerQuery = query.toLowerCase();

    return allStudents.filter(s =>
      s.first_name?.toLowerCase().includes(lowerQuery) ||
      s.last_name?.toLowerCase().includes(lowerQuery) ||
      s.admission_number?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Cache classes data
   */
  async cacheClasses(classes) {
    const db = await this.init();
    const tx = db.transaction('classes', 'readwrite');
    const store = tx.objectStore('classes');

    const timestamp = new Date().toISOString();

    for (const cls of classes) {
      await store.put({
        ...cls,
        _cached_at: timestamp,
        _version: 1
      });
    }

    await this.setSyncMetadata('classes_last_cache', timestamp);
    return classes.length;
  }

  /**
   * Get cached classes
   */
  async getClasses() {
    const db = await this.init();
    return await db.getAll('classes');
  }

  /**
   * Queue an action for later sync
   */
  async queueAction(type, payload, metadata = {}) {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');

    const action = {
      type,
      status: 'pending',
      payload,
      timestamp: new Date().toISOString(),
      checksum: this.calculateChecksum(payload),
      retry_count: 0,
      ...metadata
    };

    const localId = await store.add(action);

    // Also cache the data locally for immediate display
    if (type === 'attendance') {
      await this.cacheLocalAttendance(payload, localId);
    } else if (type === 'grade') {
      await this.cacheLocalGrade(payload, localId);
    }

    return localId;
  }

  /**
   * Cache attendance locally for immediate display
   */
  async cacheLocalAttendance(payload, localId) {
    const db = await this.init();
    const cacheKey = `${payload.student_id}_${payload.date}`;

    const tx = db.transaction('cached_attendance', 'readwrite');
    const store = tx.objectStore('cached_attendance');
    await store.put({
      cache_key: cacheKey,
      student_id: payload.student_id,
      class_id: payload.class_id,
      attendance_date: payload.date,
      status: payload.status,
      local_id: localId,
      is_pending: true,
      _cached_at: new Date().toISOString()
    });
  }

  /**
   * Cache grade locally for immediate display
   */
  async cacheLocalGrade(payload, localId) {
    const db = await this.init();
    const cacheKey = `${payload.student_id}_${payload.subject}_${payload.term}`;

    const tx = db.transaction('cached_grades', 'readwrite');
    const store = tx.objectStore('cached_grades');
    await store.put({
      cache_key: cacheKey,
      student_id: payload.student_id,
      subject: payload.subject,
      term: payload.term,
      marks: payload.marks,
      total_marks: payload.total_marks,
      local_id: localId,
      is_pending: true,
      _cached_at: new Date().toISOString()
    });
  }

  /**
   * Get pending actions for sync
   */
  async getPendingActions(limit = 100) {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readonly');
    const index = tx.objectStore('pending_actions').index('status');

    // Get pending actions ordered by timestamp
    const pending = await index.getAll('pending');
    return pending
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(0, limit);
  }

  /**
   * Update action status after sync attempt
   */
  async updateActionStatus(localId, status, serverData = {}) {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');

    const action = await store.get(localId);
    if (!action) return null;

    action.status = status;
    action.last_sync_attempt = new Date().toISOString();

    if (status === 'synced') {
      action.server_id = serverData.server_id;
      action.synced_at = serverData.server_timestamp;

      // Update cached data to show as synced
      if (action.type === 'attendance') {
        await this.markAttendanceSynced(action.payload, localId);
      }
    } else if (status === 'failed') {
      action.retry_count = (action.retry_count || 0) + 1;
      action.last_error = serverData.error;
    } else if (status === 'conflict') {
      action.conflict_data = serverData.conflict;
    }

    await store.put(action);
    return action;
  }

  /**
   * Mark cached attendance as synced
   */
  async markAttendanceSynced(payload, localId) {
    const db = await this.init();
    const cacheKey = `${payload.student_id}_${payload.date}`;

    const tx = db.transaction('cached_attendance', 'readwrite');
    const store = tx.objectStore('cached_attendance');
    const cached = await store.get(cacheKey);
    if (cached) {
      cached.is_pending = false;
      cached.synced_at = new Date().toISOString();
      await store.put(cached);
    }
  }

  /**
   * Get attendance for a student on a specific date
   */
  async getAttendance(studentId, date) {
    const db = await this.init();
    const cacheKey = `${studentId}_${date}`;
    const tx = db.transaction('cached_attendance', 'readonly');
    const store = tx.objectStore('cached_attendance');
    return await store.get(cacheKey);
  }

  /**
   * Get all attendance for a date range
   */
  async getAttendanceByDateRange(startDate, endDate, classId = null) {
    const db = await this.init();
    const tx = db.transaction('cached_attendance', 'readonly');
    const index = tx.objectStore('cached_attendance').index('date');

    const allAttendance = await index.getAll();

    return allAttendance.filter(a => {
      const date = a.attendance_date;
      const inRange = date >= startDate && date <= endDate;
      const classMatch = classId ? a.class_id === classId : true;
      return inRange && classMatch;
    });
  }

  /**
   * Get grade for a student
   */
  async getGrade(studentId, subject, term) {
    const db = await this.init();
    const cacheKey = `${studentId}_${subject}_${term}`;
    const tx = db.transaction('cached_grades', 'readonly');
    const store = tx.objectStore('cached_grades');
    return await store.get(cacheKey);
  }

  /**
   * Delete a pending action (after successful sync or manual delete)
   */
  async deleteAction(localId) {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    await store.delete(localId);
  }

  /**
   * Get count of pending actions
   */
  async getPendingCount() {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readonly');
    const index = tx.objectStore('pending_actions').index('status');
    const pending = await index.getAll('pending');
    return pending.length;
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readonly');
    const store = tx.objectStore('pending_actions');

    const all = await store.getAll();

    return {
      pending: all.filter(a => a.status === 'pending').length,
      synced: all.filter(a => a.status === 'synced').length,
      failed: all.filter(a => a.status === 'failed').length,
      conflict: all.filter(a => a.status === 'conflict').length,
      total: all.length
    };
  }

  /**
   * Set sync metadata
   */
  async setSyncMetadata(key, value) {
    const db = await this.init();
    const tx = db.transaction('sync_metadata', 'readwrite');
    const store = tx.objectStore('sync_metadata');
    await store.put({
      key,
      value,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(key) {
    const db = await this.init();
    const tx = db.transaction('sync_metadata', 'readonly');
    const store = tx.objectStore('sync_metadata');
    const data = await store.get(key);
    return data?.value;
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp() {
    return await this.getSyncMetadata('last_successful_sync');
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTimestamp() {
    await this.setSyncMetadata('last_successful_sync', new Date().toISOString());
  }

  /**
   * Get device ID (generate if not exists)
   */
  async getDeviceId() {
    let deviceId = await this.getSyncMetadata('device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      await this.setSyncMetadata('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Clear all cached data (logout)
   */
  async clearAllData() {
    const db = await this.init();

    const stores = [
      'students', 'classes', 'subjects',
      'pending_actions', 'cached_attendance', 'cached_grades'
    ];

    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readwrite');
      await tx.objectStore(storeName).clear();
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  calculateChecksum(payload) {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate unique device ID
   */
  generateDeviceId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `device_${timestamp}_${random}`;
  }

  /**
   * Export pending actions as backup (before risky operations)
   */
  async exportPendingActions() {
    const pending = await this.getPendingActions(1000);
    return {
      exported_at: new Date().toISOString(),
      device_id: await this.getDeviceId(),
      actions: pending
    };
  }

  /**
   * Import pending actions (restore from backup)
   */
  async importPendingActions(backup) {
    const db = await this.init();
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');

    let imported = 0;
    for (const action of backup.actions) {
      // Check if already exists
      const existing = await store.get(action.local_id);
      if (!existing) {
        await store.add({
          ...action,
          status: 'pending', // Reset to pending
          imported_at: new Date().toISOString()
        });
        imported++;
      }
    }

    return imported;
  }
}

// Singleton instance
const offlineDatabase = new OfflineDatabase();

export default offlineDatabase;
export { OfflineDatabase };
