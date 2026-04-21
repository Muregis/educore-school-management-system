import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// ─── Get announcements ──────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { target_audience, status = 'published' } = req.query;
    
    let query = supabase
      .from('announcements')
      .select(`
        announcement_id, title, message, type, status, priority, 
        target_audience, pinned, publish_date, expiry_date, created_at,
        users!inner(full_name)
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('pinned', { ascending: false })
      .order('publish_date', { ascending: false })
      .order('created_at', { ascending: false });

    // OLD: .eq('status', status)
    if (role === "parent" || role === "student") {
      query = query
        .eq("status", "published")
        .in("target_audience", role === "parent" ? ["all", "parents"] : ["all", "students"]);
    } else {
      query = status === "all" ? query : query.eq("status", status);
    }

    if (target_audience && role !== "parent" && role !== "student") {
      query = query.eq('target_audience', target_audience);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (err) { next(err); }
});

// ─── Create announcement ───────────────────────────────────────────────────
router.post("/", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId, user } = req.user;
    const { title, message, type = 'general', priority = 'normal', target_audience = 'all', pinned = false, publish_date, expiry_date } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        school_id: schoolId,
        title,
        message,
        type,
        status: 'draft',
        priority,
        target_audience,
        pinned,
        publish_date: publish_date || null,
        expiry_date: expiry_date || null,
        author_user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// ─── Update announcement ───────────────────────────────────────────────────
router.put("/:id", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { title, message, type, status, priority, target_audience, pinned, publish_date, expiry_date } = req.body;

    const { data, error } = await supabase
      .from('announcements')
      .update({
        title,
        message,
        type,
        status,
        priority,
        target_audience,
        pinned,
        publish_date,
        expiry_date,
        updated_at: new Date().toISOString()
      })
      .eq('announcement_id', id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Announcement not found" });
    
    res.json(data);
  } catch (err) { next(err); }
});

// ─── Delete announcement ───────────────────────────────────────────────────
router.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { error } = await supabase
      .from('announcements')
      .update({ 
        is_deleted: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('announcement_id', id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ─── Publish announcement ───────────────────────────────────────────────────
router.post("/:id/publish", requireRoles("admin","teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('announcements')
      .update({ 
        status: 'published',
        publish_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('announcement_id', id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Announcement not found" });
    
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
