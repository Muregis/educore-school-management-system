#!/usr/bin/env node
import fs from "fs";

// classes: section on list + POST/PATCH
{
  const path = "backend/src/routes/classes.routes.js";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("POST /api/classes - Create a class")) {
    t = t.replace(
      '.select("class_id, class_name, next_class_name")',
      '.select("class_id, class_name, next_class_name, section, status")'
    );
    const idx = t.lastIndexOf("export default router;");
    if (idx === -1) { console.error("classes: no export"); process.exit(1); }
    const head = t.slice(0, idx);
    const addon = `\n/**\n * POST /api/classes - Create a class (supports stream via section)\n */\nrouter.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {\n  try {\n    const { schoolId } = req.user;\n    const class_name = String(req.body.class_name || "").trim();\n    if (!class_name) return res.status(400).json({ message: "class_name is required" });\n    const section = req.body.section != null && String(req.body.section).trim()\n      ? String(req.body.section).trim()\n      : null;\n    const row = {\n      school_id: schoolId,\n      class_name,\n      section,\n      status: "active",\n      is_deleted: false,\n      next_class_name: req.body.next_class_name || null,\n      class_order: req.body.class_order != null ? Number(req.body.class_order) : 0,\n      created_at: new Date().toISOString(),\n      updated_at: new Date().toISOString(),\n    };\n    const { data, error } = await supabase\n      .from("classes")\n      .insert(row)\n      .select("class_id, class_name, section, status, next_class_name")\n      .single();\n    if (error) throw error;\n    res.status(201).json({ data });\n  } catch (err) {\n    next(err);\n  }\n});\n\n/**\n * PATCH /api/classes/:classId - Update class / stream (section)\n */\nrouter.patch("/:classId", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {\n  try {\n    const { schoolId } = req.user;\n    const { classId } = req.params;\n    const update = { updated_at: new Date().toISOString() };\n    if (req.body.class_name != null) update.class_name = String(req.body.class_name).trim();\n    if (req.body.section !== undefined) {\n      update.section = req.body.section === null || req.body.section === ""\n        ? null\n        : String(req.body.section).trim();\n    }\n    if (req.body.status != null) update.status = String(req.body.status);\n    if (req.body.next_class_name !== undefined) update.next_class_name = req.body.next_class_name || null;\n    const { data, error } = await supabase\n      .from("classes")\n      .update(update)\n      .eq("school_id", schoolId)\n      .eq("class_id", classId)\n      .select("class_id, class_name, section, status, next_class_name")\n      .single();\n    if (error) throw error;\n    if (!data) return res.status(404).json({ message: "Class not found" });\n    res.json({ data });\n  } catch (err) {\n    next(err);\n  }\n});\n\nexport default router;\n`;
    fs.writeFileSync(path, head + addon);
    console.log("classes updated");
  } else console.log("classes ok");
}

// analysis stream labels + ranking CBC
{
  const path = "backend/src/routes/analysis.routes.js";
  let t = fs.readFileSync(path, "utf8");
  const oldAgg = `        streamAgg.set(key, {\n          class_name: c.class_name,\n          stream: c.section,\n          stream_label: \\'\\${c.class_name} \\${c.section}\\',\n          class_id: c.class_id,\n          studentIds: new Set(),\n          sum: 0,\n          count: 0,\n        });`;
  // Use actual backticks in file - reconstruct carefully
  const oldAgg2 = [
    "        streamAgg.set(key, {",
    "          class_name: c.class_name,",
    "          stream: c.section,",
    "          stream_label: `${c.class_name} ${c.section}`,",
    "          class_id: c.class_id,",
    "          studentIds: new Set(),",
    "          sum: 0,",
    "          count: 0,",
    "        });",
  ].join("\n");
  const newAgg2 = [
    "        const sec = c.section ? String(c.section).trim() : \"\";",
    "        streamAgg.set(key, {",
    "          class_name: c.class_name,",
    "          stream: sec || null,",
    "          stream_label: sec ? `${c.class_name} ${sec}` : String(c.class_name || \"\"),",
    "          class_id: c.class_id,",
    "          studentIds: new Set(),",
    "          sum: 0,",
    "          count: 0,",
    "        });",
  ].join("\n");
  // Fix escaping - write without broken escapes
}

console.log("partial - use dedicated analysis patch below");
