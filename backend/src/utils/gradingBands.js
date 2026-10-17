/**
 * Flexible school grading bands.
 * Prefer school_settings: grading_scale + grading_sub_levels (or grading_bands JSON).
 * Defaults are only a fallback when the school has not configured anything.
 */

import { supabase } from "../config/supabaseClient.js";

/** Fallback CBC-style bands (used only when school has no settings) */
export const DEFAULT_CBC_BANDS = [
  { code: "EE1", parent: "EE", min: 90, max: 100, label: "Exceeds Expectations (1)" },
  { code: "EE2", parent: "EE", min: 80, max: 89, label: "Exceeds Expectations (2)" },
  { code: "ME1", parent: "ME", min: 70, max: 79, label: "Meets Expectations (1)" },
  { code: "ME2", parent: "ME", min: 65, max: 69, label: "Meets Expectations (2)" },
  { code: "AE1", parent: "AE", min: 55, max: 64, label: "Approaches Expectations (1)" },
  { code: "AE2", parent: "AE", min: 50, max: 54, label: "Approaches Expectations (2)" },
  { code: "BE1", parent: "BE", min: 40, max: 49, label: "Below Expectations (1)" },
  { code: "BE2", parent: "BE", min: 0, max: 39, label: "Below Expectations (2)" },
];

function parseJson(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return null;
  }
}

export function normalizeBands(raw) {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length) {
    const bands = raw
      .map((b) => ({
        code: String(b.code || b.grade || b.knec_grade || "").toUpperCase(),
        parent: String(b.parent || b.level || "").toUpperCase() || null,
        min: Number(b.min ?? b.min_percentage),
        max: b.max != null || b.max_percentage != null ? Number(b.max ?? b.max_percentage) : null,
        label: b.label || b.description || String(b.code || b.grade || ""),
      }))
      .filter((b) => b.code && Number.isFinite(b.min));
    bands.sort((a, b) => b.min - a.min);
    for (let i = 0; i < bands.length; i++) {
      if (bands[i].max == null) {
        bands[i].max = i === 0 ? 100 : bands[i - 1].min - 0.01;
      }
    }
    for (const b of bands) {
      if (!b.parent) b.parent = b.code.replace(/\d+$/, "") || b.code;
    }
    return bands.length ? bands : null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const entries = Object.entries(raw)
      .map(([code, min]) => ({ code: String(code).toUpperCase(), min: Number(min) }))
      .filter((e) => e.code && Number.isFinite(e.min))
      .sort((a, b) => b.min - a.min);
    if (!entries.length) return null;
    const bands = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const hiMax = i === 0 ? 100 : entries[i - 1].min - 0.0001;
      const mid = (e.min + (i === 0 ? 100 : entries[i - 1].min)) / 2;
      const hiMin = Math.max(e.min, Math.ceil(mid));
      if (hiMin < hiMax && hiMin > e.min) {
        bands.push({ code: e.code + "1", parent: e.code, min: hiMin, max: hiMax, label: e.code + "1" });
        bands.push({ code: e.code + "2", parent: e.code, min: e.min, max: hiMin - 0.0001, label: e.code + "2" });
      } else {
        bands.push({ code: e.code, parent: e.code, min: e.min, max: hiMax, label: e.code });
      }
    }
    bands.sort((a, b) => b.min - a.min);
    return bands;
  }
  return null;
}

export function gradeFromBands(percentage, bands = DEFAULT_CBC_BANDS) {
  const p = Number(percentage);
  if (!Number.isFinite(p)) {
    return { grade: "-", level: "-", parent: "-", label: "No Score", percentage: null };
  }
  const list = bands && bands.length ? bands : DEFAULT_CBC_BANDS;
  const hit = list.find((b) => p >= b.min) || list[list.length - 1];
  const parent = hit.parent || hit.code.replace(/\d+$/, "") || hit.code;
  return {
    grade: hit.code,
    level: parent,
    parent,
    label: hit.label || hit.code,
    percentage: p,
    min: hit.min,
    max: hit.max,
  };
}

export async function loadSchoolGradingBands(schoolId) {
  if (!schoolId) return DEFAULT_CBC_BANDS;
  try {
    const { data, error } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .eq("school_id", schoolId)
      .in("setting_key", ["grading_bands", "grading_sub_levels", "grading_scale"]);
    if (error) {
      console.warn("[gradingBands] settings read failed", error.message);
      return DEFAULT_CBC_BANDS;
    }
    const map = new Map((data || []).map((r) => [r.setting_key, r.setting_value]));
    for (const key of ["grading_bands", "grading_sub_levels", "grading_scale"]) {
      const parsed = parseJson(map.get(key));
      const bands = normalizeBands(parsed);
      if (bands && bands.length) return bands;
    }
  } catch (e) {
    console.warn("[gradingBands] load error", e.message);
  }
  return DEFAULT_CBC_BANDS;
}

export function makeGrader(bands) {
  const b = bands && bands.length ? bands : DEFAULT_CBC_BANDS;
  return (percentage) => gradeFromBands(percentage, b);
}

export default {
  DEFAULT_CBC_BANDS,
  normalizeBands,
  gradeFromBands,
  loadSchoolGradingBands,
  makeGrader,
};
