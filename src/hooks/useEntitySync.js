import { useEffect } from "react";
import { apiFetch } from "../lib/api";

export function useEntitySync({
  url,
  token,
  setter,
  transform = (x) => x,
  enabled = true,
  intervalMs = 5 * 60 * 1000,
  dependencies = [],
  fetcher = null,
}) {
  useEffect(() => {
    if (!token || !enabled || (!url && !fetcher)) return;

    const fetchEntity = async (signal) => {
      try {
        if (fetcher) {
          await fetcher(signal);
        } else {
          const data = await apiFetch(url, { token, signal });
          if (setter) setter(transform(data));
        }
      } catch (err) {
        if (err.name !== "AbortError" && err.code !== "EABORT") {
          console.warn(`[useEntitySync] Failed:`, err.message || err);
        }
      }
    };

    const ac = new AbortController();
    fetchEntity(ac.signal);

    let interval;
    if (intervalMs > 0) {
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchEntity();
        }
      }, intervalMs);
    }

    return () => {
      ac.abort();
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, url, setter, enabled, intervalMs, ...dependencies]);
}
