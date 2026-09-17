import { supabase } from "../config/supabaseClient.js";
import { resolvePasswordPolicy, validatePassword } from "../middleware/passwordPolicy.js";

/**
 * Load the effective password policy for a school, falling back to platform defaults.
 */
export async function getSchoolPasswordPolicy(schoolId) {
  if (!schoolId) return resolvePasswordPolicy(null);
  try {
    const { data } = await supabase
      .from("schools")
      .select("security_settings")
      .eq("school_id", schoolId)
      .maybeSingle();
    return resolvePasswordPolicy(data?.security_settings?.passwordPolicy || null);
  } catch {
    return resolvePasswordPolicy(null);
  }
}

/**
 * Reject the request when `password` violates the school's policy.
 * Returns true when a response has already been sent.
 */
export async function rejectWeakPassword(res, password, { schoolId, email, name } = {}) {
  const policy = await getSchoolPasswordPolicy(schoolId);
  const check = validatePassword(password, { email, firstName: name }, policy);
  if (check.valid) return false;
  res.status(400).json({
    message: "Password does not meet security requirements",
    errors: check.errors,
    policy,
  });
  return true;
}
