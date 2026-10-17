router.get("/merit", authRequired, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const term = req.query.term;
    const className = req.query.class_name ? String(req.query.class_name).trim() : null;
    const streamFilter = req.query.stream ? String(req.query.stream).trim() : null;
    if (!term) return res.status(400).json({ error: "Term parameter is required" });

    const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

    let raw = [];
    {
      const primary = await supabase
        .from("results")
        .select("term,subject,marks,total_marks,student_id,class_id,is_deleted,school_id")
        .eq("school_id", schoolId)
        .eq("term", term);
      if (primary.error) {
        const fb = await supabase
          .from("results")
          .select("term,subject,marks,total_marks,student_id,school_id")
          .eq("school_id", schoolId)
          .eq("term", term);
        if (fb.error) throw fb.error;
        raw = (fb.data || []).map((r) => ({ ...r, is_deleted: false, class_id: null }));
      } else {
        raw = (primary.data || []).filter((r) => r.is_deleted !== true);
      }
    }

    const studentIds = [...new Set(raw.map((r) => r.student_id).filter(Boolean))];

    const [{ data: classesRows, error: classesErr }, { data: studentsRows, error: studentsErr }] = await Promise.all([
      supabase
        .from("classes")
        .select("class_id,class_name,section,is_deleted,status")
        .eq("school_id", schoolId),
      studentIds.length
        ? supabase
            .from("students")
            .select("student_id,first_name,last_name,admission_number,class_name,is_deleted,status")
            .eq("school_id", schoolId)
            .in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesErr) throw classesErr;
    if (studentsErr) throw studentsErr;

    const activeClasses = (classesRows || []).filter(
      (c) => c.is_deleted !== true && (c.status == null || c.status === "active")
    );
    const classById = new Map(activeClasses.map((c) => [c.class_id, c]));
    const classByName = new Map(activeClasses.map((c) => [classKey(c.class_name), c]));
    const studentById = new Map((studentsRows || []).map((s) => [s.student_id, s]));

    const getClass = (r) => {
      if (r.class_id && classById.has(r.class_id)) return classById.get(r.class_id);
      const s = studentById.get(r.student_id);
      if (!s) return null;
      const byName = classByName.get(classKey(s.class_name));
      if (byName) return byName;
      const full = String(s.class_name || "").trim();
      if (!full) return null;
      return { class_id: null, class_name: full, section: null, is_deleted: false, status: "active", _synthetic: true };
    };

    const matchesClassFilter = (c, s) => {
      if (!className) return true;
      const want = norm(className);
      const cn = norm(c?.class_name);
      const sn = norm(s?.class_name);
      if (cn === want || sn === want) return true;
      if (cn.startsWith(want + " ") || sn.startsWith(want + " ")) return true;
      return false;
    };

    const matchesStream = (c, s) => {
      if (!streamFilter) return true;
      const want = norm(streamFilter);
      const sec = norm(c?.section);
      if (sec && sec === want) return true;
      const label = norm(c?.class_name || s?.class_name);
      if (label.endsWith(" " + want) || label === want) return true;
      return false;
    };

    const pct = (r) => {
      let denom = Number(r.total_marks || 0);
      const marks = Number(r.marks);
      if (!Number.isFinite(marks) || marks < 0) return null;
      if (!denom || denom <= 0) denom = 100;
      return (marks / denom) * 100;
    };

    const subLevel = (percentage) => {
      if (percentage == null || Number.isNaN(percentage)) return { grade: "-", parent: "-" };
      const p = Number(percentage);
      if (p >= 90) return { grade: "EE1", parent: "EE" };
      if (p >= 80) return { grade: "EE2", parent: "EE" };
      if (p >= 70) return { grade: "ME1", parent: "ME" };
      if (p >= 65) return { grade: "ME2", parent: "ME" };
      if (p >= 55) return { grade: "AE1", parent: "AE" };
      if (p >= 50) return { grade: "AE2", parent: "AE" };
      if (p >= 40) return { grade: "BE1", parent: "BE" };
      return { grade: "BE2", parent: "BE" };
    };

    const cleanRows = raw.filter((r) => {
      const s = studentById.get(r.student_id);
      if (!s || s.is_deleted === true) return false;
      if (s.status && s.status !== "active") return false;
      const c = getClass(r);
      if (!matchesClassFilter(c, s)) return false;
      if (!matchesStream(c || {}, s)) return false;
      return true;
    });

    const subjectSet = new Set();
    const studentAgg = new Map();
    for (const r of cleanRows) {
      const p = pct(r);
      if (p == null) continue;
      const subj = r.subject || "Subject";
      subjectSet.add(subj);
      if (!studentAgg.has(r.student_id)) {
        studentAgg.set(r.student_id, {
          sum: 0, count: 0, totalMarks: 0,
          class_id: r.class_id, class_ref: getClass(r), subjects: {},
        });
      }
      const a = studentAgg.get(r.student_id);
      a.sum += p; a.count += 1; a.totalMarks += Number(r.marks || 0);
      const sl = subLevel(p);
      a.subjects[subj] = {
        marks: Number(r.marks || 0),
        total: Number(r.total_marks || 100),
        percentage: Number(p.toFixed(1)),
        sub_level: sl.grade,
        grade: sl.parent,
      };
      a.class_ref = getClass(r) || a.class_ref;
    }

    const subjects = [...subjectSet].sort((a, b) => a.localeCompare(b));
    const scored = [...studentAgg.entries()]
      .map(([student_id, a]) => {
        const s = studentById.get(student_id) || {};
        const c = a.class_ref || classById.get(a.class_id) || {};
        const average = a.count ? Number((a.sum / a.count).toFixed(2)) : 0;
        const overall = subLevel(average);
        const streamLabel =
          c.class_name && c.section
            ? `${c.class_name} ${c.section}`
            : c.class_name || s.class_name || "";
        return {
          student_id,
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          admission_number: s.admission_number || null,
          class_name: c.class_name || s.class_name || "",
          stream: c.section || "",
          stream_label: streamLabel,
          total_marks: a.totalMarks,
          average,
          overall_grade: overall.parent,
          overall_sub_level: overall.grade,
          subjects: a.subjects,
          subjects_sat: Object.keys(a.subjects).length,
        };
      })
      .sort((a, b) => b.average - a.average || b.total_marks - a.total_marks);

    let currentRank = 1;
    let prevAvg = null;
    const rows = scored.map((s, idx) => {
      if (prevAvg !== null && s.average < prevAvg - 0.001) currentRank = idx + 1;
      prevAvg = s.average;
      return { ...s, rank: currentRank };
    });

    const streamSet = new Set();
    for (const c of activeClasses) {
      if (className && !matchesClassFilter(c, { class_name: c.class_name })) continue;
      if (c.section) streamSet.add(String(c.section).trim());
    }
    for (const s of studentsRows || []) {
      if (s.is_deleted === true) continue;
      if (!matchesClassFilter({ class_name: s.class_name }, s)) continue;
      const parts = String(s.class_name || "").trim().split(/\s+/);
      if (parts.length >= 2 && className && norm(s.class_name).startsWith(norm(className) + " ")) {
        streamSet.add(parts[parts.length - 1]);
      }
    }
    const streams = [...streamSet].filter(Boolean).sort();

    res.json({
      rows,
      subjects,
      streams,
      meta: {
        term,
        class_name: className,
        stream: streamFilter,
        mode: streamFilter ? "stream" : "consolidated",
        learner_count: rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
