import { useEffect, useRef, useState } from "react";

/**
 * Keys that must NEVER be persisted. They are high-churn school data.
 * Reading them from localStorage caused phones/same-tab sessions to show
 * stale lists until the user opened incognito (empty storage).
 */
const EPHEMERAL_KEYS = new Set([
  "educore.school",
  "educore.users",
  "educore.students",
  "educore.teachers",
  "educore.attendance",
  "educore.results",
  "educore.feeStructures",
  "educore.payments",
  "educore.notifications",
  "educore.timetable",
  "educore.pendingUpdates",
]);

/** One-time wipe of legacy forever-cached entity blobs. */
const WIPE_FLAG = "educore.entityCacheCleared.v3";
if (typeof window !== "undefined" && !localStorage.getItem(WIPE_FLAG)) {
  try {
    EPHEMERAL_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(WIPE_FLAG, "1");
  } catch {
    // ignore quota / private mode
  }
}

/**
 * React state with optional localStorage persistence.
 * Entity/school list keys are memory-only (API is source of truth).
 */
export function useLocalState(key, fallback) {
  const ephemeral = EPHEMERAL_KEYS.has(key);

  const [state, setState] = useState(() => {
    if (ephemeral) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  });

  const persistTimer = useRef(null);

  useEffect(() => {
    if (ephemeral) return undefined;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn(`[useLocalState] Failed to persist "${key}" to localStorage.`, err);
      }
    }, 150);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [key, state, ephemeral]);

  return [state, setState];
}
