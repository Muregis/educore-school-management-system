#!/usr/bin/env node
import fs from "fs";
const path = "backend/src/routes/classes.routes.js";
let t = fs.readFileSync(path, "utf8");
if (t.includes("POST /api/classes - Create a class")) {
  console.log("already applied");
  process.exit(0);
}
t = t.replace(
  '.select("class_id, class_name, next_class_name")',
  '.select("class_id, class_name, next_class_name, section, status")'
);
const addon = `
/**
 * POST /api/classes - Create a class (supports stream via section)
 * Body: { class_name, section?, next_class_name?, class_order? }
 */
router.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const class_name = String(req.body.class_name || "").trim();
    if (!class_name) return res.status(400).json({ message: "class_name is required" });
    const section = req.body.section != null && String(req.body.section).trim()
      ? String(req.body.section).trim()
      : null;
    const row = {
      school_id: schoolId,
      class_name,
      section,
      status: "active",
      is_deleted: false,
      next_class_name: req.body.next_class_name || null,
      class_order: req.body.class_order != null ? Number(req.body.class_order) : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("classes").insert(row).select("class_id, class_name, section, status, next_class_name").single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/classes/:classId - Update class name / section (stream)
 */
router.patch("/:classId", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const update = { updated_at: new Date().toISOString() };
    if (req.body.class_name != null) update.class_name = String(req.body.class_name).trim();
    if (req.body.section !== undefined) {
      update.section = req.body.section === null || req.body.section === ""
        ? null
        : String(req.body.section).trim();
    }
    if (req.body.status != null) update.status = String(req.body.status);
    if (req.body.next_class_name !== undefined) update.next_class_name = req.body.next_class_name || null;
    const { data, error } = await supabase
      .from("classes")
      .update(update)
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .select("class_id, class_name, section, status, next_class_name")
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Class not found" });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
`;
if (!t.includes("export default router")) {
  console.error("no export");
  process.exit(1);
}
t = t.replace(/\nexport default router;\s*$/, "\n" + addon);
fs.writeFileSync(path, t);
console.log("applied class streams API");
