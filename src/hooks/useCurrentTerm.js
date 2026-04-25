/**
 * useCurrentTerm Hook
 * 
 * Fetches the current active academic term from the backend.
 * Replaces hardcoded terms like "Term 2" across the application.
 * 
 * Usage:
 *   const { term, academicYear, isLoading, error } = useCurrentTerm(auth);
 *   
 *   // In forms:
 *   <select value={selectedTerm} onChange={...}>
 *     <option value={term}>{term}</option>
 *   </select>
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

// Cache duration - 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let cachedTerm = null;
let cachedAt = null;

export function useCurrentTerm(auth, options = {}) {
  const { useCache = true } = options;
  
  const [state, setState] = useState({
    term: null,
    academicYear: null,
    termId: null,
    yearId: null,
    startDate: null,
    endDate: null,
    isActive: false,
    isLoading: true,
    error: null
  });

  const fetchCurrentTerm = useCallback(async () => {
    // Return cached data if valid
    if (useCache && cachedTerm && cachedAt && (Date.now() - cachedAt < CACHE_DURATION)) {
      setState(prev => ({ ...prev, ...cachedTerm, isLoading: false }));
      return;
    }

    if (!auth?.token) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'No authentication token' 
      }));
      return;
    }

    try {
      // Try to fetch current term from API
      const response = await apiFetch('/terms/current', { 
        token: auth.token 
      });

      // Handle different response formats
      const termData = response.data || response;

      if (!termData || !termData.term) {
        // Fallback: try to get terms list and find active one
        const termsResponse = await apiFetch('/terms', { token: auth.token });
        const terms = termsResponse.data || termsResponse || [];
        
        const now = new Date();
        const activeTerm = terms.find(t => {
          const start = new Date(t.start_date || t.startDate);
          const end = new Date(t.end_date || t.endDate);
          return now >= start && now <= end;
        }) || terms[0]; // Fallback to first term

        if (activeTerm) {
          const result = {
            term: activeTerm.term_name || activeTerm.term || 'Term 1',
            academicYear: activeTerm.academic_year || activeTerm.academicYear || new Date().getFullYear().toString(),
            termId: activeTerm.term_id || activeTerm.id,
            yearId: activeTerm.academic_year_id || activeTerm.yearId,
            startDate: activeTerm.start_date || activeTerm.startDate,
            endDate: activeTerm.end_date || activeTerm.endDate,
            isActive: true,
            isLoading: false,
            error: null
          };
          
          cachedTerm = result;
          cachedAt = Date.now();
          setState(result);
          return;
        }

        // Ultimate fallback
        const fallback = getFallbackTerm();
        setState({ ...fallback, isLoading: false });
        return;
      }

      const result = {
        term: termData.term_name || termData.term,
        academicYear: termData.academic_year || termData.academicYear,
        termId: termData.term_id || termData.id,
        yearId: termData.academic_year_id || termData.yearId,
        startDate: termData.start_date || termData.startDate,
        endDate: termData.end_date || termData.endDate,
        isActive: termData.status === 'active' || termData.isActive,
        isLoading: false,
        error: null
      };

      cachedTerm = result;
      cachedAt = Date.now();
      setState(result);

    } catch (err) {
      console.error('Failed to fetch current term:', err);
      
      // Use fallback on error
      const fallback = getFallbackTerm();
      setState({ 
        ...fallback, 
        isLoading: false, 
        error: err.message 
      });
    }
  }, [auth, useCache]);

  useEffect(() => {
    fetchCurrentTerm();
  }, [fetchCurrentTerm]);

  // Manual refresh function
  const refresh = useCallback(() => {
    cachedTerm = null;
    cachedAt = null;
    setState(prev => ({ ...prev, isLoading: true }));
    fetchCurrentTerm();
  }, [fetchCurrentTerm]);

  return {
    ...state,
    refresh,
    // Convenience getters
    get currentTerm() { return state.term; },
    get currentYear() { return state.academicYear; },
    get isReady() { return !state.isLoading && state.term; }
  };
}

/**
 * Get all terms for a school
 */
export function useTerms(auth) {
  const [terms, setTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth?.token) {
      setIsLoading(false);
      return;
    }

    apiFetch('/terms', { token: auth.token })
      .then(data => {
        const termsList = data.data || data || [];
        setTerms(termsList);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [auth]);

  return { terms, isLoading, error };
}

/**
 * Fallback term calculation based on current date
 * Kenya academic year: Jan-Dec with terms typically:
 * - Term 1: Jan - April
 * - Term 2: May - August  
 * - Term 3: September - December
 */
function getFallbackTerm() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  
  let term;
  let academicYear;
  
  // Kenyan school calendar approximation
  if (month >= 0 && month <= 3) { // Jan-Apr
    term = 'Term 1';
    academicYear = year.toString();
  } else if (month >= 4 && month <= 7) { // May-Aug
    term = 'Term 2';
    academicYear = year.toString();
  } else { // Sep-Dec
    term = 'Term 3';
    academicYear = year.toString();
  }
  
  return {
    term,
    academicYear,
    termId: null,
    yearId: null,
    startDate: null,
    endDate: null,
    isActive: true,
    isLoading: false,
    error: null,
    isFallback: true
  };
}

/**
 * Hook for term-aware operations
 * Automatically reloads data when term changes
 */
export function useTermAware(auth, fetchFunction, deps = []) {
  const { term, academicYear, isReady } = useCurrentTerm(auth);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isReady || !auth?.token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchFunction({ term, academicYear, token: auth.token })
      .then(result => {
        setData(result);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [term, academicYear, isReady, auth, fetchFunction, ...deps]);

  return { data, isLoading, error, term, academicYear };
}

export default useCurrentTerm;
