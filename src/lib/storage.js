import { useState, useEffect } from "react";

export function useLocalState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      console.error("useLocalState parsing error", e);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("useLocalState write error", e);
    }
  }, [key, value]);

  return [value, setValue];
}

export const STORAGE_KEYS = {
  users: "educore_users",
  students: "educore_students",
  settings: "educore_settings",
  // add others as needed
};
