/**
 * Data Deduplication Utilities
 * Prevents repeated data in UI components
 */

/**
 * Remove duplicates from array of objects based on a key
 */
export function removeDuplicates(array, key) {
  if (!Array.isArray(array)) return [];
  
  const seen = new Set();
  return array.filter(item => {
    const value = item && item[key];
    if (value == null) {
      // Keep items with null/undefined values but don't track them for deduplication
      return true;
    }
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Remove duplicates from array of objects based on multiple keys
 */
export function removeDuplicatesByMultipleKeys(array, keys) {
  if (!Array.isArray(array)) return [];
  
  const seen = new Set();
  return array.filter(item => {
    const key = keys.map(k => item[k]).join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicate students by admission number
 */
export function deduplicateStudents(students) {
  return removeDuplicates(students, 'admission_number');
}

/**
 * Deduplicate payments by transaction ID
 */
export function deduplicatePayments(payments) {
  if (!Array.isArray(payments)) return [];
  // Try different possible keys for payment identification
  const key = payments.length > 0 && payments[0].transaction_id ? 'transaction_id' : 
              payments.length > 0 && payments[0].id ? 'id' : 'transaction_id';
  return removeDuplicates(payments, key);
}

/**
 * Deduplicate grades by student+subject+term+year combination
 */
export function deduplicateGrades(grades) {
  if (!Array.isArray(grades)) return [];
  // Handle different possible key structures for grades
  return removeDuplicatesByMultipleKeys(grades, ['student_id', 'subject', 'term', 'academic_year']);
}

/**
 * Deduplicate attendance by student+date combination
 */
export function deduplicateAttendance(attendance) {
  return removeDuplicatesByMultipleKeys(attendance, ['student_id', 'date']);
}

/**
 * Merge duplicate student records, keeping most recent data
 */
export function mergeDuplicateStudents(students) {
  const grouped = {};
  
  students.forEach(student => {
    const key = student.admission_number;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(student);
  });
  
  return Object.values(grouped).map(group => {
    // Sort by updated_at or created_at, most recent first
    const sorted = group.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.created_at || 0);
      return dateB - dateA;
    });
    
    // Merge all data, preferring most recent non-null values
    const merged = { ...sorted[0] };
    
    sorted.slice(1).forEach(student => {
      Object.keys(student).forEach(key => {
        if (merged[key] == null || merged[key] === '') {
          merged[key] = student[key];
        }
      });
    });
    
    return merged;
  });
}

/**
 * Paginate data to prevent UI overload
 */
export function paginateData(data, page = 1, pageSize = 50) {
  if (!Array.isArray(data)) return { data: [], totalPages: 0, currentPage: 1 };
  
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / pageSize);
  
  return {
    data: paginatedData,
    totalPages,
    currentPage: page,
    totalItems: data.length,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}

/**
 * Filter data by search term with debouncing
 */
export function createSearchFilter(data, searchKeys = ['name', 'admission_number'], delay = 300) {
  let timeoutId;
  
  return function(searchTerm) {
    return new Promise(resolve => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (!searchTerm || searchTerm.trim() === '') {
          resolve(data);
          return;
        }
        
        const term = searchTerm.toLowerCase().trim();
        const filtered = data.filter(item => {
          return searchKeys.some(key => {
            const value = item[key];
            return value && value.toString().toLowerCase().includes(term);
          });
        });
        
        resolve(filtered);
      }, delay);
    });
  };
}

/**
 * Cache data to prevent repeated API calls
 */
export class DataCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Create a cached version of any async function
  memoize(fn, keyGenerator) {
    return async (...args) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      let result = this.get(key);
      if (result !== null) {
        return result;
      }
      
      result = await fn(...args);
      this.set(key, result);
      return result;
    };
  }
}

/**
 * Optimize data for UI display
 */
export function optimizeDataForDisplay(data, options = {}) {
  const {
    maxItems = 100,
    sortBy = 'created_at',
    sortOrder = 'desc',
    removeNulls = true,
    removeDuplicates = true,
    uniqueKey = 'id'
  } = options;
  
  if (!Array.isArray(data)) return data;
  
  let result = [...data];
  
  // Remove null/undefined values
  if (removeNulls) {
    result = result.filter(item => item != null);
  }
  
  // Remove duplicates
  if (removeDuplicates && uniqueKey) {
    result = removeDuplicates(result, uniqueKey);
  }
  
  // Sort
  if (sortBy) {
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
  
  // Limit items
  if (maxItems > 0) {
    result = result.slice(0, maxItems);
  }
  
  return result;
}

