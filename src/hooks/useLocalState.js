import { useEffect, useRef, useState } from "react";

export function useLocalState(key, fallback) {
  const [state, setState] = useState(() => {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  });

  const persistTimer = useRef(null);

  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);

    // Debounce to avoid blocking the UI with frequent large writes (common when navigating pages).
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
  }, [key, state]);

  return [state, setState];
}
