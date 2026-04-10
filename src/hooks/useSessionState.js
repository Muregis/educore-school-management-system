import { useEffect, useRef, useState } from "react";

export function useSessionState(key, fallback) {
  const [state, setState] = useState(() => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  });

  const persistTimer = useRef(null);

  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);

    persistTimer.current = setTimeout(() => {
      try {
        if (state === null || state === undefined) {
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, JSON.stringify(state));
        }
      } catch (err) {
        console.warn(`[useSessionState] Failed to persist "${key}" to sessionStorage.`, err);
      }
    }, 50);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [key, state]);

  return [state, setState];
}
