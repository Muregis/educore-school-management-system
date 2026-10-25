/**
 * Class Level Ranking & Sorting Utility
 * Ensures class dropdowns and lists follow educational progression levels
 * rather than arbitrary alphabetical ordering.
 */

export function getClassLevelRank(name) {
  if (!name || typeof name !== "string") return 9999;
  const raw = name.trim();
  const lower = raw.toLowerCase();

  // 1. Early Childhood / Preschool / Kindergarten
  if (
    lower.startsWith("daycare") ||
    lower.startsWith("creche") ||
    lower.startsWith("playgroup") ||
    lower.startsWith("baby")
  ) {
    return 10;
  }
  if (
    lower.startsWith("pp1") ||
    lower.startsWith("pre-primary 1") ||
    lower.startsWith("pre primary 1") ||
    lower.startsWith("kg1") ||
    lower.startsWith("nursery") ||
    lower.startsWith("fs1") ||
    lower.startsWith("reception") ||
    lower.startsWith("early years")
  ) {
    return 20;
  }
  if (
    lower.startsWith("pp2") ||
    lower.startsWith("pre-primary 2") ||
    lower.startsWith("pre primary 2") ||
    lower.startsWith("kg2") ||
    lower.startsWith("pre-unit") ||
    lower.startsWith("pre unit") ||
    lower.startsWith("fs2") ||
    lower.startsWith("kindergarten")
  ) {
    return 30;
  }

  // 2. Tertiary / College Semesters: e.g. "Year 1 Sem 1", "Y1S1", "Year 2 Semester 2"
  const semMatch = lower.match(/(?:year|y)\s*(\d+)\s*(?:sem|semester|s)\s*(\d+)/i);
  if (semMatch) {
    const y = parseInt(semMatch[1], 10);
    const s = parseInt(semMatch[2], 10);
    return 400 + y * 20 + s * 5;
  }

  // 3. College / TVET levels
  if (lower.includes("artisan") || lower.includes("foundation") || lower.includes("bridging")) return 300;
  if (lower.includes("certificate") || lower.includes("cert")) {
    const certNum = lower.match(/(?:year|level|stage|part)\s*(\d+)/i);
    return 310 + (certNum ? parseInt(certNum[1], 10) : 0);
  }
  if (lower.includes("diploma") || lower.includes("dip")) {
    const dipNum = lower.match(/(?:year|level|stage|part)\s*(\d+)/i);
    return 320 + (dipNum ? parseInt(dipNum[1], 10) : 0);
  }

  // 4. Senior Secondary / Forms: Form 1 - 4
  const formMatch = lower.match(/\bform\s*(\d+)\b/i);
  if (formMatch) {
    const num = parseInt(formMatch[1], 10);
    return 200 + num;
  }

  // 5. Numbered Grades: Grade 1 - 13
  const gradeMatch = lower.match(/\bgrade\s*(\d+)\b/i);
  if (gradeMatch) {
    const num = parseInt(gradeMatch[1], 10);
    if (num <= 9) return 100 + num;
    return 200 + (num - 9);
  }

  // 6. Standard / Class / Std / Primary / P: Class 1 - 8
  const classStdMatch = lower.match(/\b(?:class|standard|std|primary|p)\s*(\d+)\b/i);
  if (classStdMatch) {
    const num = parseInt(classStdMatch[1], 10);
    if (num <= 9) return 100 + num;
    return 200 + (num - 9);
  }

  // 7. International / British: Year 1 - 13 (not followed by sem)
  const yearMatch = lower.match(/\byear\s*(\d+)\b/i);
  if (yearMatch) {
    const num = parseInt(yearMatch[1], 10);
    if (num <= 9) return 100 + num;
    return 200 + (num - 9);
  }

  // 8. Solo number at beginning, e.g. "1 East", "7B"
  const soloNumMatch = lower.match(/^(\d{1,2})(?:\s*[a-z]|$)/i);
  if (soloNumMatch) {
    const num = parseInt(soloNumMatch[1], 10);
    if (num <= 9) return 100 + num;
    return 200 + (num - 9);
  }

  return 9000;
}

export function compareClasses(a, b) {
  const nameA = typeof a === "string" ? a : a?.class_name || a?.name || a?.className || "";
  const nameB = typeof b === "string" ? b : b?.class_name || b?.name || b?.className || "";

  const orderA =
    typeof a === "object" && a !== null && Number.isFinite(a.class_order) && a.class_order > 0
      ? a.class_order
      : null;
  const orderB =
    typeof b === "object" && b !== null && Number.isFinite(b.class_order) && b.class_order > 0
      ? b.class_order
      : null;

  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB;
  }

  const rankA = getClassLevelRank(nameA);
  const rankB = getClassLevelRank(nameB);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
}

export function sortClasses(classList = []) {
  if (!Array.isArray(classList)) return [];
  return [...classList].sort(compareClasses);
}

export default {
  getClassLevelRank,
  compareClasses,
  sortClasses,
};
