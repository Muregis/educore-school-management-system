#!/usr/bin/env node
import fs from "fs";

function patch(path, fn) {
  let t = fs.readFileSync(path, "utf8");
  t = fn(t);
  fs.writeFileSync(path, t);
  console.log("patched", path);
}

// 1) Class name normalize — backend
patch("backend/src/services/feeBalanceCalculator.js", (t) => {
  if (!t.includes("function normalizeClassName")) {
    t = t.replace(
      "function toNumber(value) {",
      `function normalizeClassName(name) {
  return String(name ?? "").trim().replace(/\\s+/g, " ").toLowerCase();
}

function classNamesMatch(a, b) {
  return normalizeClassName(a) === normalizeClassName(b) && normalizeClassName(a) !== "";
}

function findFeeStructureForClass(feeStructures = [], className) {
  return (feeStructures || []).find(
    (f) => classNamesMatch(f?.className ?? f?.class_name, className)
  );
}

function toNumber(value) {`
    );
  }
  t = t.replace(
    /const structure = feeStructures\.find\(\s*\(f\)\s*=>\s*\(f\?\.className\s*\?\?\s*f\?\.class_name\)\s*===\s*className\s*\);/g,
    "const structure = findFeeStructureForClass(feeStructures, className);"
  );
  t = t.replace(
    /const structure = feeStructures\.find\(\n\s*\(f\)\s*=>\s*\(f\?\.className\s*\?\?\s*f\?\.class_name\)\s*===\s*className\n\s*\);/g,
    "const structure = findFeeStructureForClass(feeStructures, className);"
  );
  return t;
});

// 1b) frontend
patch("src/services/studentBalanceUtils.js", (t) => {
  if (!t.includes("function normalizeClassName")) {
    t = t.replace(
      "function toNumber(value) {",
      `function normalizeClassName(name) {
  return String(name ?? "").trim().replace(/\\s+/g, " ").toLowerCase();
}

function classNamesMatch(a, b) {
  return normalizeClassName(a) === normalizeClassName(b) && normalizeClassName(a) !== "";
}

function findFeeStructureForClass(feeStructures = [], className) {
  return (feeStructures || []).find(
    (f) => classNamesMatch(f?.className ?? f?.class_name, className)
  );
}

function toNumber(value) {`
    );
  }
  t = t.replace(
    `export function getStudentClassName(student) {
  return student?.className ?? student?.class_name ?? "";
}`,
    `export function getStudentClassName(student) {
  return String(student?.className ?? student?.class_name ?? "").trim().replace(/\\s+/g, " ");
}`
  );
  t = t.replaceAll(
    "const structure = feeStructures.find(f => (f?.className ?? f?.class_name) === className);",
    "const structure = findFeeStructureForClass(feeStructures, className);"
  );
  t = t.replace(
    "return feeStructures.some(f => (f?.className ?? f?.class_name) === className);",
    "return feeStructures.some(f => classNamesMatch(f?.className ?? f?.class_name, className));"
  );
  return t;
});

// 2) Analytics
patch("backend/src/routes/analytics.routes.js", (t) => {
  if (!t.includes("async function resolveCurrentTermName")) {
    t = t.replace(
      "const router = Router();\nrouter.use(authRequired);",
      `const router = Router();
router.use(authRequired);

async function resolveCurrentTermName(schoolId) {
  try {
    const { data: current, error } = await supabase
      .from('terms')
      .select('term_name')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (!error && current?.term_name) return current.term_name;
    const { data: anyTerm } = await supabase
      .from('terms')
      .select('term_name')
      .eq('school_id', schoolId)
      .limit(1)
      .maybeSingle();
    return anyTerm?.term_name || null;
  } catch {
    return null;
  }
}
`
    );
  }
  t = t.replace(
    "    const currentTerm = term || 'Term 2'; // Default to Term 2 if not specified",
    "    const currentTerm = term || await resolveCurrentTermName(schoolId);"
  );
  const oldFee = `      const { data: feeStructures, error: feeErr } = await supabase
        .from('fee_structures')
        .select('class_name, tuition, activity, misc')
        .eq('school_id', schoolId)
        .eq('term', currentTerm)
        .eq('is_deleted', false);
      if (feeErr) throw feeErr;

      const studentIds = allStudents?.map(s => s.student_id) || [];
      if (studentIds.length > 0) {
        const { data: allPayments, error: payListErr } = await supabase
          .from('payments')
          .select('student_id, amount, term')
          .eq('school_id', schoolId)
          .in('status', ['paid', 'completed', 'success'])
          .eq('term', currentTerm)
          .eq('is_deleted', false)
          .in('student_id', studentIds);
        if (payListErr) throw payListErr;`;
  const neuFee = `      let feeQ = supabase
        .from('fee_structures')
        .select('class_name, tuition, activity, misc')
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (currentTerm) feeQ = feeQ.eq('term', currentTerm);
      const { data: feeStructures, error: feeErr } = await feeQ;
      if (feeErr) throw feeErr;

      const studentIds = allStudents?.map(s => s.student_id) || [];
      if (studentIds.length > 0) {
        let payQ = supabase
          .from('payments')
          .select('student_id, amount, term')
          .eq('school_id', schoolId)
          .in('status', ['paid', 'completed', 'success'])
          .eq('is_deleted', false)
          .in('student_id', studentIds);
        if (currentTerm) payQ = payQ.eq('term', currentTerm);
        const { data: allPayments, error: payListErr } = await payQ;
        if (payListErr) throw payListErr;`;
  if (t.includes(oldFee)) t = t.replace(oldFee, neuFee);
  return t;
});

// 3) TENANT_DEBUG off by default
patch("backend/src/helpers/tenant-debug.logger.js", (t) =>
  t.replace(
    'const isDebugEnabled = (process.env.TENANT_DEBUG || "true").toLowerCase() !== "false";',
    'const isDebugEnabled = (process.env.TENANT_DEBUG || "false").toLowerCase() === "true";'
  )
);

// Auth debug gate
patch("backend/src/middleware/auth.js", (t) => {
  if (!t.includes("AUTH_DEBUG_ENABLED")) {
    const lines = t.split("\n");
    let last = 0;
    lines.forEach((l, i) => {
      if (l.startsWith("import ")) last = i;
    });
    lines.splice(
      last + 1,
      0,
      'const AUTH_DEBUG_ENABLED = (process.env.AUTH_DEBUG || process.env.TENANT_DEBUG || "false").toLowerCase() === "true";'
    );
    t = lines.join("\n");
  }
  t = t.replaceAll("console.log('[AUTH DEBUG]", "AUTH_DEBUG_ENABLED && console.log('[AUTH DEBUG]");
  t = t.replaceAll("console.log(`[AUTH DEBUG]", "AUTH_DEBUG_ENABLED && console.log(`[AUTH DEBUG]");
  return t;
});

// 4) KES
patch("src/lib/utils.js", (t) =>
  t.replace(
    "export const money = v => `KSh ${Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;",
    "export const money = v => `KES ${Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;"
  )
);
patch("src/lib/format.js", (t) => t.replaceAll("KSh ", "KES "));

// 5) Fees terms
patch("src/pages/FeesPage.jsx", (t) => {
  if (!t.includes("availableTerms")) {
    t = t.replace(
      '  const [selectedTerm, setSelectedTerm] = useState("current");',
      `  const [selectedTerm, setSelectedTerm] = useState("current");
  const [availableTerms, setAvailableTerms] = useState([]);`
    );
    t = t.replace(
      '  const displayTerm = selectedTerm === "current" ? (term || "Term 2") : selectedTerm;',
      `  const displayTerm = selectedTerm === "current" ? (term || availableTerms[0] || "Term 1") : selectedTerm;
  useEffect(() => {
    if (!auth?.token) return;
    let ignore = false;
    apiFetch("/academic/terms", { token: auth.token })
      .then((data) => {
        if (ignore) return;
        const list = Array.isArray(data) ? data : (data?.data || data?.terms || []);
        const names = [...new Set(list.map((x) => x.term_name || x.name || x.term).filter(Boolean))];
        setAvailableTerms(names);
      })
      .catch(() => { if (!ignore) setAvailableTerms([]); });
    return () => { ignore = true; };
  }, [auth?.token]);`
    );
  }
  const oldBtns = `            <Button variant={selectedTerm==="current" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("current")}>Current Term</Button>
            <Button variant={selectedTerm==="Term 1" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("Term 1")}>Term 1</Button>
            <Button variant={selectedTerm==="Term 2" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("Term 2")}>Term 2</Button>
            <Button variant={selectedTerm==="Term 3" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("Term 3")}>Term 3</Button>
            <Button variant={selectedTerm==="all" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("all")}>All Time (All Terms)</Button>`;
  const neuBtns = `            <Button variant={selectedTerm==="current" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("current")}>Current Term</Button>
            {(availableTerms.length ? availableTerms : ["Term 1", "Term 2", "Term 3"]).map((tn) => (
              <Button key={tn} variant={selectedTerm===tn ? "secondary" : "ghost"} onClick={() => setSelectedTerm(tn)}>{tn}</Button>
            ))}
            <Button variant={selectedTerm==="all" ? "secondary" : "ghost"} onClick={() => setSelectedTerm("all")}>All Time (All Terms)</Button>`;
  if (t.includes(oldBtns)) t = t.replace(oldBtns, neuBtns);
  const oldOpts = `              { value: "Term 1", label: "Term 1" },
              { value: "Term 2", label: "Term 2" },
              { value: "Term 3", label: "Term 3" }`;
  const neuOpts = `              ...(availableTerms.length ? availableTerms : ["Term 1", "Term 2", "Term 3"]).map((tn) => ({ value: tn, label: tn }))`;
  if (t.includes(oldOpts)) t = t.replace(oldOpts, neuOpts);
  return t;
});

console.log("ALL 5 HARDENING FIXES APPLIED");
