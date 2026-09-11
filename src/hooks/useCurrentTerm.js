import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

const TERM_CACHE_TTL = 30 * 1000;
const TERM_REQUEST_TIMEOUT_MS = 12000;
const termCache = new Map();

const initialState = {
  term: null,
  academicYear: null,
  startDate: null,
  endDate: null,
  isActive: false,
  isLoading: true,
  error: null,
  scope: null,
};

export function getTermCacheKey(auth) {
  const schoolId = auth?.schoolId ?? auth?.school_id ?? auth?.activeSchoolId;
  return `${schoolId || "anonymous"}:${auth?.token || "anonymous"}`;
}

function getCachedTerm(cacheKey) {
  const entry = termCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > TERM_CACHE_TTL) {
    termCache.delete(cacheKey);
    return null;
  }

  return entry.term;
}

function normalizeTerm(termData) {
  if (!termData || (!termData.term_name && !termData.term)) return null;

  return {
    term: termData.term_name || termData.term,
    academicYear: termData.academic_year || termData.academicYear || null,
    startDate: termData.start_date || termData.startDate || null,
    endDate: termData.end_date || termData.endDate || null,
    isActive: Boolean(
      termData.is_current ?? termData.isCurrent ?? termData.status === "active"
    ),
  };
}

export function clearCurrentTermCache(cacheKey = null) {
  if (cacheKey) {
    termCache.delete(cacheKey);
    return;
  }

  termCache.clear();
}

export function useCurrentTerm(auth, options = {}) {
  const { useCache = true } = options;
  const [state, setState] = useState(() => ({
    ...initialState,
    isLoading: Boolean(auth?.token),
    scope: auth?.token ? getTermCacheKey(auth) : null,
  }));
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const previousCacheKeyRef = useRef(null);

  const fetchCurrentTerm = useCallback(async () => {
    const cacheKey = getTermCacheKey(auth);
    const cachedTerm = useCache ? getCachedTerm(cacheKey) : null;

    if (previousCacheKeyRef.current !== null && previousCacheKeyRef.current !== cacheKey) {
      controllerRef.current?.abort();
      setState({
        ...initialState,
        isLoading: Boolean(auth?.token),
        error: null,
        scope: cacheKey,
      });
    }
    previousCacheKeyRef.current = cacheKey;
    controllerRef.current?.abort();

    if (cachedTerm) {
      setState({ ...cachedTerm, isLoading: false, error: null, scope: cacheKey });
      return;
    }

    if (!auth?.token) {
      setState({ ...initialState, isLoading: false, error: null, scope: null });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setState({ ...initialState, isLoading: true, error: null, scope: cacheKey });

    try {
      const response = await apiFetch("/academic/terms/current", {
        token: auth.token,
        signal: controller.signal,
        timeoutMs: TERM_REQUEST_TIMEOUT_MS,
        retries: 0,
      });
      let termData = response?.data || response;
      let result = normalizeTerm(termData);

      if (!result) {
        const termsResponse = await apiFetch("/academic/terms", {
          token: auth.token,
          signal: controller.signal,
          timeoutMs: TERM_REQUEST_TIMEOUT_MS,
          retries: 0,
        });
        const terms = Array.isArray(termsResponse?.data)
          ? termsResponse.data
          : Array.isArray(termsResponse)
            ? termsResponse
            : [];
        const activeTerm = terms.find((item) => item?.is_current || item?.isCurrent)
          || terms.find((item) => item?.status === "active" || item?.status === "Active")
          || null;
        result = normalizeTerm(activeTerm);
      }

      if (requestId !== requestIdRef.current) return;

      if (!result) {
        setState((current) => ({
          ...current,
          term: null,
          academicYear: null,
          startDate: null,
          endDate: null,
          isActive: false,
          isLoading: false,
          error: "No active academic term found.",
          scope: cacheKey,
        }));
        return;
      }

      termCache.set(cacheKey, { term: result, cachedAt: Date.now() });
      setState({ ...result, isLoading: false, error: null, scope: cacheKey });
    } catch (err) {
      if (requestId !== requestIdRef.current || err?.code === "EABORT") return;

      setState((current) => ({
        ...current,
        term: null,
        academicYear: null,
        startDate: null,
        endDate: null,
        isActive: false,
        isLoading: false,
        error: err?.message || "Unable to load the current term.",
        scope: cacheKey,
      }));
    }
  }, [auth, useCache]);

  useEffect(() => {
    fetchCurrentTerm();
    return () => controllerRef.current?.abort();
  }, [fetchCurrentTerm]);

  const refresh = useCallback(() => {
    termCache.delete(getTermCacheKey(auth));
    fetchCurrentTerm();
  }, [auth, fetchCurrentTerm]);

  return { ...state, refresh };
}

export function useTerms(auth) {
  const [terms, setTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(auth?.token));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth?.token) {
      setTerms([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setError(null);

    apiFetch("/academic/terms", {
      token: auth.token,
      signal: controller.signal,
      timeoutMs: TERM_REQUEST_TIMEOUT_MS,
      retries: 0,
    })
      .then((response) => {
        const data = Array.isArray(response?.data) ? response.data : response;
        if (active) setTerms(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active && err?.code !== "EABORT") {
          setError(err?.message || "Unable to load terms.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [auth?.token]);

  return { terms, isLoading, error };
}

export function useTermAware(value, term) {
  return term
    ? value?.filter((item) => item?.term === term.term || item?.term_name === term.term)
    : value;
}
