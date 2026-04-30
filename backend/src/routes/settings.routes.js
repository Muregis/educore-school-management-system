import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

async function ensureSchoolSettingsTable() {
  const { error } = await supabase
    .from("school_settings")
    .select("school_id", { count: "exact", head: true });

  if (error && error.code === "PGRST205") {
    return { missing: true };
  }

  if (error) throw error;
  return { missing: false };
}

async function getSchoolSettingsMap(schoolId) {
  const check = await ensureSchoolSettingsTable();
  if (check.missing) return new Map();

  const { data, error } = await supabase
    .from("school_settings")
    .select("setting_key, setting_value")
    .eq("school_id", schoolId);
  if (error) throw error;

  return new Map((data || []).map((row) => [row.setting_key, row.setting_value]));
}

async function upsertSchoolSettings(schoolId, values) {
  const check = await ensureSchoolSettingsTable();
  if (check.missing) return { skipped: true };

  const rows = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([setting_key, setting_value]) => ({
      school_id: schoolId,
      setting_key,
      setting_value: String(setting_value),
    }));

  console.log('[DEBUG] upsertSchoolSettings - schoolId:', schoolId, 'rows:', rows.map(r => r.setting_key));

  if (!rows.length) {
    console.log('[DEBUG] upsertSchoolSettings - no rows to save');
    return { skipped: false };
  }

  const { error } = await supabase
    .from("school_settings")
    .upsert(rows, { onConflict: "school_id,setting_key" });
  if (error) {
    console.error('[DEBUG] upsertSchoolSettings error:', error);
    throw error;
  }

  console.log('[DEBUG] upsertSchoolSettings - saved successfully');
  return { skipped: false };
}

// NEW: GET /api/settings/users (frontend expects this path)
// Directors can use ?all=true to see users from all schools
router.get("/users", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { all } = req.query;
    const currentUserId = String(req.user?.user_id || req.user?.userId || "");
    
    console.log(`[DEBUG] Settings/users: schoolId=${schoolId}, currentUserId=${currentUserId}, role=${role}`);

    let query = supabase
      .from("users")
      .select("user_id, full_name, email, phone, role, status, created_at, is_deleted, school_id")
      .eq("is_deleted", false);

    // Directors/superadmins can request all schools
    if ((role === 'director' || role === 'superadmin') && all === 'true') {
      // Get all school IDs director can access
      const { getAccessibleSchoolIds } = await import('../services/branch.service.js');
      const accessibleIds = await getAccessibleSchoolIds(req.user.user_id, schoolId);
      query = query.in('school_id', accessibleIds);
    } else {
      // Regular school-scoped query
      query = query.eq("school_id", schoolId);
    }

    query = query.order("role").order("full_name");

    const { data, error } = await query;
    
    if (error) {
      console.error(`[DEBUG] Supabase error:`, error);
      throw error;
    }

    console.log(`[DEBUG] Found ${data?.length || 0} users from DB`);
    if (data?.length > 0) {
      console.log(`[DEBUG] First user:`, data[0]);
    }

    const rows = Array.isArray(data) ? [...data] : [];
    const hasCurrentUser = rows.some((user) => String(user.user_id) === currentUserId);
    
    console.log(`[DEBUG] hasCurrentUser=${hasCurrentUser}, currentUserId=${currentUserId}`);

    if (!hasCurrentUser && currentUserId) {
      console.log(`[DEBUG] Injecting current user into results`);
      rows.unshift({
        user_id: req.user.user_id || req.user.userId,
        full_name: req.user.name || "Current Admin",
        email: req.user.email || "",
        phone: "",
        role: req.user.role || "admin",
        status: "active",
        created_at: null,
        is_session_user: true,
      });
    }
    
    console.log(`[DEBUG] Returning ${rows.length} users`);
    res.json(rows);
  } catch (err) { 
    console.error(`[DEBUG] Error:`, err);
    next(err); 
  }
});

router.get("/school", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    // Prefer Supabase fluent API (no raw SQL, no MySQL fallback)
    const { data, error } = await supabase
      .from("schools")
      .select("school_id, name, email, phone, whatsapp_business_number, address, county, logo_url, primary_color, motto")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .single();

    if (error) throw error;

    const settings = await getSchoolSettingsMap(schoolId);

    res.json({
      ...data,
      term: settings.get("current_term") || "",
      year: settings.get("academic_year") || "",
      term_start: settings.get("term_start") || settings.get("term_start_date") || "",
      term_end: settings.get("term_end") || settings.get("term_end_date") || "",
      motto: data.motto || settings.get("school_motto") || "",
      tagline: settings.get("school_tagline") || "",
      hero_message: settings.get("hero_message") || "",
      logo_url: data.logo_url || settings.get("logo_url") || settings.get("school_logo") || "",
      primary_color: data.primary_color || settings.get("primary_color") || "",
      secondary_color: settings.get("secondary_color") || "",
      established_year: settings.get("established_year") || "",
      admin_name: settings.get("admin_name") || "",
      admin_title: settings.get("admin_title") || "",
      school_type: settings.get("school_type") || "",
      type: settings.get("school_type") || "",  // alias for frontend compatibility
      curriculum: settings.get("curriculum") || "",
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/school - update school profile fields except WhatsApp number
router.put("/school", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    console.log('[DEBUG] PUT /settings/school - schoolId:', schoolId, 'body:', req.body);
    const {
      name,
      email,
      phone,
      address,
      county,
      term,
      year,
      term_start,
      term_end,
      motto,
      tagline,
      hero_message,
      logo_url,
      primary_color,
      secondary_color,
      established_year,
      admin_name,
      admin_title,
      school_type,
      curriculum,
    } = req.body;

    const updatePayload = {
      // OLD: school profile update endpoint was missing, causing frontend 404s.
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (phone !== undefined) updatePayload.phone = phone;
    if (address !== undefined) updatePayload.address = address;
    if (county !== undefined) updatePayload.county = county;
    if (logo_url !== undefined) updatePayload.logo_url = logo_url;
    if (primary_color !== undefined) updatePayload.primary_color = primary_color;
    if (motto !== undefined) updatePayload.motto = motto;
    const { data, error } = await supabase
      .from("schools")
      .update(updatePayload)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select("school_id, name, email, phone, whatsapp_business_number, address, county, logo_url, primary_color, motto")
      .single();
    if (error) throw error;

    await upsertSchoolSettings(schoolId, {
      current_term: term,
      academic_year: year,
      term_start: term_start,
      term_end: term_end,
      term_start_date: term_start,  // alias for compatibility
      term_end_date: term_end,      // alias for compatibility
      school_motto: motto,
      school_tagline: tagline,
      hero_message,
      logo_url,
      primary_color,
      secondary_color,
      established_year,
      admin_name,
      admin_title,
      school_type,
      curriculum,
    });

    const settings = await getSchoolSettingsMap(schoolId);

    res.json({
      updated: true,
      school: {
        ...data,
        term: settings.get("current_term") || "",
        year: settings.get("academic_year") || "",
        term_start: settings.get("term_start") || settings.get("term_start_date") || "",
        term_end: settings.get("term_end") || settings.get("term_end_date") || "",
        motto: settings.get("school_motto") || "",
        tagline: settings.get("school_tagline") || "",
        hero_message: settings.get("hero_message") || "",
        logo_url: settings.get("logo_url") || settings.get("school_logo") || "",
        primary_color: settings.get("primary_color") || "",
        secondary_color: settings.get("secondary_color") || "",
        established_year: settings.get("established_year") || "",
        admin_name: settings.get("admin_name") || "",
        admin_title: settings.get("admin_title") || "",
        school_type: settings.get("school_type") || "",
        curriculum: settings.get("curriculum") || "",
      },
    });
  } catch (err) { next(err); }
});

// GET /api/settings/payment-config - Bank details for frontend
router.get("/payment-config", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    // Get bank details from payment_configs table
    const { data, error } = await supabase
      .from("payment_configs")
      .select("bank_name, bank_account_number, account_name, bank_branch")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    res.json(data || {
      bank_name: "",
      bank_account_number: "",
      account_name: "",
      bank_branch: ""
    });
  } catch (err) {
    next(err);
  }
});

async function ensurePermissionsTable() {
  // Check if table exists by trying to query it
  const { error } = await supabase
    .from('role_permissions')
    .select('*', { count: 'exact', head: true });

  if (error && error.code === 'PGRST205') {
    // Table doesn't exist - for now, just return missing
    // In production, this table should be created via Supabase dashboard migration
    console.warn('role_permissions table does not exist. Please create it in Supabase dashboard using the migration SQL.');
    return { missing: true };
  }

  if (error) {
    console.error('Error checking role_permissions table:', error);
    return { missing: true };
  }

  return { missing: false };
}

router.get("/permissions", requireRoles("admin", "director", "superadmin", "parent", "student"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const check = await ensurePermissionsTable();
    if (check.missing) {
      return res.json({ permissions: {} });
    }

    const { data: rows, error: queryError } = await supabase
      .from('role_permissions')
      .select('role_name, can_edit, pages_json')
      .eq('school_id', schoolId);
    if (queryError) throw queryError;

    const permissions = Object.fromEntries(
      (rows || []).map(r => [r.role_name, { edit: Boolean(r.can_edit), pages: JSON.parse(r.pages_json || "[]") }])
    );

    res.json({ permissions });
  } catch (err) {
    next(err);
  }
});

router.put("/permissions", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ message: "permissions object is required" });
    }

    const check = await ensurePermissionsTable();
    if (check.missing) {
      return res.status(400).json({ message: "role_permissions table is missing. Run the migration and retry." });
    }

    for (const [roleName, cfg] of Object.entries(permissions)) {
      const pages = Array.isArray(cfg?.pages) ? cfg.pages : [];
      const canEdit = cfg?.edit ? true : false;

      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          school_id: schoolId,
          role_name: roleName,
          can_edit: canEdit,
          pages_json: JSON.stringify(pages)
        }, { onConflict: 'school_id,role_name' });
      if (error) throw error;
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// ─── School WhatsApp Business Number Management ─────────────────────────────

// GET school settings including WhatsApp number
// OLD: duplicate GET /school handler existed; consolidated above to avoid route ambiguity.

// PATCH school WhatsApp business number
router.patch("/school/whatsapp", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { whatsapp_business_number } = req.body;

    console.log('[DEBUG] PATCH /school/whatsapp - schoolId:', schoolId, 'received:', whatsapp_business_number);

    // Validate WhatsApp number format (Kenyan) - supports 07, 01, 254, +254 prefixes
    if (whatsapp_business_number) {
      const cleanNumber = whatsapp_business_number.replace(/[^\d+]/g, '');
      console.log('[DEBUG] Cleaned number:', cleanNumber);
      const phoneRegex = /^(\+?254|0)[17][0-9]{8}$/;
      if (!phoneRegex.test(cleanNumber)) {
        console.log('[DEBUG] Validation FAILED for:', cleanNumber);
        return res.status(400).json({ 
          message: "Invalid WhatsApp number format. Use: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, or +2541xxxxxxxx" 
        });
      }
      console.log('[DEBUG] Validation passed');
    }

    console.log('[DEBUG] Updating Supabase with:', whatsapp_business_number);
    const { data, error } = await supabase
      .from("schools")
      .update({ 
        whatsapp_business_number: whatsapp_business_number || null,
        updated_at: new Date().toISOString()
      })
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select("school_id, whatsapp_business_number")
      .single();

    if (error) {
      console.log('[DEBUG] Supabase error:', error);
      throw error;
    }
    if (!data) {
      console.log('[DEBUG] No data returned from Supabase');
      return res.status(404).json({ message: "School not found" });
    }

    console.log('[DEBUG] Success - saved:', data.whatsapp_business_number);
    res.json({ 
      updated: true, 
      whatsapp_business_number: data.whatsapp_business_number 
    });
  } catch (err) { 
    console.log('[DEBUG] Error caught:', err.message);
    next(err); 
  }
});

export default router;
