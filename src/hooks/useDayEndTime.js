import { useState, useCallback } from "react";

const STORAGE_KEY = "dayEndTime";
const DEFAULT_TIME = "18:00";

/**
 * Shared hook for day-end time used by FeesPage (and potentially Dashboard).
 * Prevents ReferenceError in production builds and keeps the value consistent.
 */
export function useDayEndTime() {
  const [dayEndTime, setDayEndTimeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_TIME;
    } catch {
      return DEFAULT_TIME;
    }
  });

  const setDayEndTime = useCallback((time) => {
    const safe = time || DEFAULT_TIME;
    setDayEndTimeState(safe);
    try {
      localStorage.setItem(STORAGE_KEY, safe);
    } catch {
      // ignore quota / private-mode errors
    }
  }, []);

  return { dayEndTime, setDayEndTime };
}
