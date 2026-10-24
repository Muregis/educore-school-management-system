import { supabase } from "../config/supabaseClient.js";

/**
 * Resolves school settings (such as default lunch and breakfast daily rates and days)
 * to ensure that fee balance calculations across Reports, Analytics, Dashboard,
 * Term Closures, and Fees page are 100% synchronized with the canonical formula.
 *
 * @param {string|number} schoolId
 * @returns {Promise<Object>} School fee settings defaults
 */
export async function getSchoolSettings(schoolId) {
  if (!schoolId) return {};

  try {
    const { data: settingsData, error } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .eq("school_id", schoolId);

    const map = new Map((settingsData || []).map((r) => [r.setting_key, r.setting_value]));

    let schoolData = null;
    if (!map.has("lunch_daily_rate")) {
      const { data } = await supabase
        .from("schools")
        .select("lunch_daily_rate, lunch_days, breakfast_daily_rate, breakfast_days")
        .eq("school_id", schoolId)
        .maybeSingle();
      schoolData = data;
    }

    return {
      lunch_daily_rate: Number(map.get("lunch_daily_rate") ?? schoolData?.lunch_daily_rate ?? 0),
      lunch_days: Number(map.get("lunch_days") ?? schoolData?.lunch_days ?? 0),
      lunch_billing_type: map.get("lunch_billing_type") ?? schoolData?.lunch_billing_type ?? "termly",
      breakfast_daily_rate: Number(map.get("breakfast_daily_rate") ?? schoolData?.breakfast_daily_rate ?? 0),
      breakfast_days: Number(map.get("breakfast_days") ?? schoolData?.breakfast_days ?? 0),
      breakfast_billing_type: map.get("breakfast_billing_type") ?? schoolData?.breakfast_billing_type ?? "termly",
    };
  } catch (err) {
    console.warn("[schoolSettings] Failed to fetch settings:", err.message);
    return {};
  }
}
