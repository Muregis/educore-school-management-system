import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// NEW: GET /api/settings/users (frontend expects this path)
router.get("/users", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    // Prefer Supabase fluent API (no raw SQL, no MySQL fallback)
    const { data, error } = await supabase
      .from("users")
      .select("user_id, full_name, email, phone, role, status, created_at")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("role")
      .order("full_name");
    if (error) throw error;

    res.json(data || []);
  } catch (err) { next(err); }
});

router.get("/school", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    // Prefer Supabase fluent API (no raw SQL, no MySQL fallback)
    const { data, error } = await supabase
      .from("schools")
      .select("school_id, name, email, phone, whatsapp_business_number, address, county")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/school - update school profile fields except WhatsApp number
router.put("/school", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      name,
      email,
      phone,
      address,
      county,
      term,
      year,
      motto
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
    // OLD: if (term !== undefined) updatePayload.term = term;
    // OLD: if (year !== undefined) updatePayload.year = year;
    // OLD: if (motto !== undefined) updatePayload.motto = motto;
    // Current schools schema does not yet include term/year/motto columns.
    void term;
    void year;
    void motto;

    const { data, error } = await supabase
      .from("schools")
      .update(updatePayload)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select("school_id, name, email, phone, whatsapp_business_number, address, county")
      .single();
    if (error) throw error;

    res.json({ updated: true, school: data });
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
    // Table doesn't exist - create it via RPC or migration
    console.warn('role_permissions table does not exist. Please run the migration to create it.');
    return { missing: true };
  }
  return { missing: false };
}

router.get("/permissions", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const check = await ensurePermissionsTable();
    if (check.missing) {
      return res.json({ permissions: {} });
    }
    
    const { data: rows, error } = await supabase
      .from('role_permissions')
      .select('role_name, can_edit, pages_json')
      .eq('school_id', schoolId);
    if (error) throw error;

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

    // Validate WhatsApp number format (Kenyan)
    if (whatsapp_business_number) {
      const cleanNumber = whatsapp_business_number.replace(/[^\d]/g, '');
      if (!/^2547[0-9]{8}$/.test(cleanNumber)) {
        return res.status(400).json({ 
          message: "Invalid WhatsApp number format. Use: 2547xxxxxxxx or +2547xxxxxxxx" 
        });
      }
    }

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

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "School not found" });

    res.json({ 
      updated: true, 
      whatsapp_business_number: data.whatsapp_business_number 
    });
  } catch (err) { next(err); }
});

export default router;
