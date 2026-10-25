import { database } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";
import { logAuditEvent } from "../helpers/audit.logger.js";
import { calculateStudentFeeBalance } from "./feeBalanceCalculator.js";
import { getSchoolSettings } from "./schoolSettings.service.js";

const TERM_TRANSITION_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function generateIdempotencyKey(schoolId, termId, operation) {
  return `term_transition:${schoolId}:${termId}:${operation}`;
}

async function withIdempotencyGuard(key, ttlMs, fn) {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("idempotency_keys")
      .select("response_payload, created_at")
      .eq("key", key)
      .maybeSingle();

    if (fetchError) {
      console.error("Idempotency guard fetch failed:", fetchError.message);
    } else if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age < ttlMs && existing.response_payload) {
        return existing.response_payload;
      }
    }
  } catch (guardError) {
    console.error("Idempotency guard read failed:", guardError);
  }

  const result = await fn();

  try {
    await supabase.from("idempotency_keys").upsert(
      {
        key,
        response_payload: result,
        created_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (guardError) {
    console.error("Idempotency guard write failed:", guardError);
  }

  return result;
}

export class TermService {
  static async createTerm(schoolId, termData) {
    try {
      const { term_name, academic_year_id, start_date, end_date, term_order, is_current = false } = termData;

      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      if (endDate <= startDate) {
        throw new Error("End date must be after start date");
      }

      const { data: existing } = await database.query("terms", {
        where: { term_name, school_id: schoolId, academic_year_id },
        limit: 1,
      });

      if (existing && existing.length > 0) {
        throw new Error(`Term ${term_name} already exists for this academic year`);
      }

      if (is_current) {
        await database.update(
          "terms",
          { is_current: false },
          { school_id: schoolId }
        );
      }

      const { data: term } = await database.insert("terms", {
        school_id: schoolId,
        academic_year_id,
        term_name,
        term_order: term_order || 1,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        status: "upcoming",
        legacy_term_value: term_name,
        is_current: Boolean(is_current),
        is_deleted: false,
      });

      return term[0];
    } catch (error) {
      console.error("Create term error:", error);
      throw error;
    }
  }

  static async getCurrentTerm(schoolId) {
    try {
      // 1. Try database terms table
      try {
        const { data: terms } = await supabase
          .from('terms')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_current', true)
          .eq('is_deleted', false)
          .maybeSingle();

        if (terms) {
          return {
            ...terms,
            term: terms.term_name || terms.name || terms.term,
            term_name: terms.term_name || terms.name || terms.term,
          };
        }

        const { data: currentByDate } = await supabase
          .from('terms')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_deleted', false)
          .order('end_date', { ascending: false })
          .limit(1);

        if (currentByDate && currentByDate.length) {
          return {
            ...currentByDate[0],
            term: currentByDate[0].term_name || currentByDate[0].name || currentByDate[0].term,
            term_name: currentByDate[0].term_name || currentByDate[0].name || currentByDate[0].term,
          };
        }
      } catch (err) {
        console.warn('terms table check skipped:', err?.message);
      }

      // 2. Try academic_terms table
      try {
        const { data: aTerms } = await supabase
          .from('academic_terms')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_current', true)
          .maybeSingle();

        if (aTerms) {
          return {
            term_id: aTerms.id || aTerms.term_id || 1,
            term: aTerms.name || aTerms.term_name,
            term_name: aTerms.name || aTerms.term_name,
            academic_year: aTerms.academic_year || aTerms.academic_year_id || String(new Date().getFullYear()),
            start_date: aTerms.start_date,
            end_date: aTerms.end_date,
            is_current: true,
            status: "active",
          };
        }
      } catch (err) {
        console.warn('academic_terms table check skipped:', err?.message);
      }

      // 3. Fallback to school_settings
      try {
        const { data: settings } = await supabase
          .from('school_settings')
          .select('setting_key, setting_value')
          .eq('school_id', schoolId)
          .in('setting_key', ['current_term', 'term_start', 'term_end', 'academic_year', 'school_type']);

        const map = new Map((settings || []).map(s => [s.setting_key, s.setting_value]));
        const currentTermName = map.get('current_term');
        const academicYear = map.get('academic_year') || String(new Date().getFullYear());
        const termStart = map.get('term_start');
        const termEnd = map.get('term_end');

        if (currentTermName) {
          return {
            term_id: 1,
            term: currentTermName,
            term_name: currentTermName,
            academic_year: academicYear,
            start_date: termStart || `${academicYear}-01-06`,
            end_date: termEnd || `${academicYear}-04-04`,
            is_current: true,
            status: "active",
          };
        }
      } catch (err) {
        console.warn('school_settings fallback skipped:', err?.message);
      }

      // 4. Fallback to schools table
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('term, year, academic_year, school_type')
          .eq('school_id', schoolId)
          .maybeSingle();

        if (school?.term) {
          const yr = school.academic_year || school.year || String(new Date().getFullYear());
          return {
            term_id: 1,
            term: school.term,
            term_name: school.term,
            academic_year: yr,
            start_date: `${yr}-01-06`,
            end_date: `${yr}-04-04`,
            is_current: true,
            status: "active",
          };
        }
      } catch (err) {
        console.warn('schools table fallback skipped:', err?.message);
      }

      // 5. Ultimate safe fallback
      const y = new Date().getFullYear();
      return {
        term_id: 1,
        term: "Term 1",
        term_name: "Term 1",
        academic_year: String(y),
        start_date: `${y}-01-06`,
        end_date: `${y}-04-04`,
        is_current: true,
        status: "active",
      };
    } catch (error) {
      console.error('Get current term error:', error);
      const y = new Date().getFullYear();
      return {
        term_id: 1,
        term: "Term 1",
        term_name: "Term 1",
        academic_year: String(y),
        start_date: `${y}-01-06`,
        end_date: `${y}-04-04`,
        is_current: true,
        status: "active",
      };
    }
  }

  static async getTerms(schoolId, status = null) {
    try {
      // 1. Try database terms table
      try {
        const query = {
          where: { school_id: schoolId, is_deleted: false },
          order: { column: "term_order", ascending: true },
        };
        if (status) query.where.status = status;
        const { data: terms } = await database.query("terms", query);
        if (terms && terms.length) {
          return terms.map(t => ({
            ...t,
            term: t.term_name || t.name || t.term,
            term_name: t.term_name || t.name || t.term,
          }));
        }
      } catch (e) {
        // Continue
      }

      // 2. Try academic_terms table
      try {
        const { data: aTerms } = await supabase
          .from('academic_terms')
          .select('*')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: true });

        if (aTerms && aTerms.length) {
          return aTerms.map(t => ({
            ...t,
            term_id: t.id || t.term_id,
            term: t.name || t.term_name,
            term_name: t.name || t.term_name,
            academic_year: t.academic_year || t.academic_year_id || String(new Date().getFullYear()),
          }));
        }
      } catch (e) {
        // Continue
      }

      // 3. Fallback to standard terms based on school type
      const current = await this.getCurrentTerm(schoolId);
      const activeTermName = current?.term_name || "Term 1";
      const y = Number(current?.academic_year) || new Date().getFullYear();

      let schoolType = "primary";
      try {
        const { data: s } = await supabase
          .from('schools')
          .select('school_type')
          .eq('school_id', schoolId)
          .maybeSingle();
        if (s?.school_type) schoolType = s.school_type.toLowerCase();
      } catch (_) {}

      let list;
      if (schoolType === "college" || schoolType === "tertiary" || schoolType === "tvet") {
        list = [
          { term_id: 1, term_name: "Semester 1", term: "Semester 1", start_date: `${y}-01-12`, end_date: `${y}-05-22`, is_current: activeTermName === "Semester 1", status: activeTermName === "Semester 1" ? "active" : "upcoming", academic_year: String(y) },
          { term_id: 2, term_name: "Semester 2", term: "Semester 2", start_date: `${y}-06-08`, end_date: `${y}-10-23`, is_current: activeTermName === "Semester 2", status: activeTermName === "Semester 2" ? "active" : "upcoming", academic_year: String(y) },
          { term_id: 3, term_name: "Trimester 3", term: "Trimester 3", start_date: `${y}-11-02`, end_date: `${y}-12-18`, is_current: activeTermName === "Trimester 3", status: activeTermName === "Trimester 3" ? "active" : "upcoming", academic_year: String(y) },
        ];
      } else if (schoolType === "igcse" || schoolType === "international") {
        list = [
          { term_id: 1, term_name: "Autumn Term", term: "Autumn Term", start_date: `${y}-09-01`, end_date: `${y}-12-15`, is_current: activeTermName === "Autumn Term", status: activeTermName === "Autumn Term" ? "active" : "upcoming", academic_year: String(y) },
          { term_id: 2, term_name: "Spring Term", term: "Spring Term", start_date: `${y + 1}-01-08`, end_date: `${y + 1}-03-28`, is_current: activeTermName === "Spring Term", status: activeTermName === "Spring Term" ? "active" : "upcoming", academic_year: String(y) },
          { term_id: 3, term_name: "Summer Term", term: "Summer Term", start_date: `${y + 1}-04-15`, end_date: `${y + 1}-07-05`, is_current: activeTermName === "Summer Term", status: activeTermName === "Summer Term" ? "active" : "upcoming", academic_year: String(y) },
        ];
      } else {
        list = [
          { term_id: 1, term_name: "Term 1", term: "Term 1", start_date: `${y}-01-06`, end_date: `${y}-04-04`, is_current: activeTermName === "Term 1", status: activeTermName === "Term 1" ? "active" : "upcoming", academic_year: String(y) },
          { term_id: 2, term_name: "Term 2", term: "Term 2", start_date: `${y}-05-05`, end_date: `${y}-08-01`, is_current: activeTermName === "Term 2", status: activeTermName === "Term 2" ? "active" : "upcoming", academic_year: String(y) },
          { term_id: 3, term_name: "Term 3", term: "Term 3", start_date: `${y}-09-01`, end_date: `${y}-11-28`, is_current: activeTermName === "Term 3", status: activeTermName === "Term 3" ? "active" : "upcoming", academic_year: String(y) },
        ];
      }
      return list;
    } catch (error) {
      console.error("Get terms error:", error);
      return [];
    }
  }

  static async activateTerm(schoolId, termId, userId) {
    const client = database;

    try {
      await client.update(
        "terms",
        { is_current: false },
        { school_id: schoolId }
      );

      const { data: term } = await client.update(
        "terms",
        { status: "active", is_current: true },
        { term_id: termId, school_id: schoolId }
      );

      await logAuditEvent({ user: { userId, schoolId } }, {
        action: "term.activate",
        entity: "terms",
        entityId: termId,
        description: `Activated term ${term.term_name}`,
      });

      return term;
    } catch (error) {
      console.error("Activate term error:", error);
      throw error;
    }
  }

  static async closeTerm(schoolId, termId, userId) {
    const client = database;

    try {
      const { data: term } = await client.update(
        "terms",
          { status: "completed", is_current: false, is_closed: true },
        { term_id: termId, school_id: schoolId }
      );

      await logAuditEvent({ user: { userId, schoolId } }, {
        action: "term.close",
        entity: "terms",
        entityId: termId,
        description: `Closed term ${term.term_name}`,
      });

      return term;
    } catch (error) {
      console.error("Close term error:", error);
      throw error;
    }
  }

  static async canCloseTerm(schoolId, termId) {
    try {
      const term = await this.getTerm(schoolId, termId);
      if (!term) {
        return { canClose: false, reasons: ["Term not found"] };
      }

      if (term.is_closed || term.status === "closed" || term.status === "completed") {
        return { canClose: false, reasons: ["Term is already closed"] };
      }

      if (term.status === "locked") {
        return { canClose: false, reasons: ["Term is locked"] };
      }

      const now = new Date();
      const endDate = new Date(term.end_date);
      if (now < endDate && term.status === "active") {
        return {
          canClose: false,
          reasons: ["Term has not ended yet. Close is only allowed after the end date."],
        };
      }

      const { data: unpaidInvoices } = await database.query("invoices", {
        where: { school_id: schoolId, term: term.term_name, status: { in: "('pending','overdue')" }, is_deleted: false },
        limit: 1,
      });

      if (unpaidInvoices && unpaidInvoices.length > 0) {
        return {
          canClose: false,
          reasons: [`${unpaidInvoices.length} invoice(s) are still pending or overdue`],
        };
      }

      return { canClose: true, reasons: [] };
    } catch (error) {
      console.error("Check term closure eligibility error:", error);
      return { canClose: false, reasons: ["Error checking eligibility"] };
    }
  }

  static async getTerm(schoolId, termId) {
    try {
      const { data: terms } = await database.query("terms", {
        where: { term_id: termId, school_id: schoolId, is_deleted: false },
        limit: 1,
      });

      return terms?.[0] || null;
    } catch (error) {
      console.error("Get term error:", error);
      return null;
    }
  }

  static async findNextTerm(schoolId, currentTermId) {
    try {
      const currentTerm = await this.getTerm(schoolId, currentTermId);
      if (!currentTerm) return null;

      const sameYear = await database.query("terms", {
        where: { 
          school_id: schoolId, 
          academic_year_id: currentTerm.academic_year_id, 
          is_deleted: false 
        },
        order: { column: "term_order", ascending: true },
      });

      const next = (sameYear.data || []).find(t => t.term_id !== currentTermId && t.term_order > currentTerm.term_order);
      if (next) return next.term_id;

      const nextYear = await database.query("terms", {
        where: { school_id: schoolId, is_deleted: false },
        order: { column: "term_id", ascending: true },
      });

      const later = (nextYear.data || []).find(t => t.term_id !== currentTermId);
      return later?.term_id || null;
    } catch (error) {
      console.error("Find next term error:", error);
      return null;
    }
  }

  static async endTermTransition(schoolId, termId, userId, options = {}) {
    const { carryForwardBalances = true, archiveGrades = true, nextTermId } = options;
    const idempotencyKey = generateIdempotencyKey(schoolId, termId, "end_term");

    return withIdempotencyGuard(idempotencyKey, TERM_TRANSITION_IDEMPOTENCY_TTL_MS, async () => {
      try {
        const term = await this.getTerm(schoolId, termId);
        if (!term) {
          throw new Error("Term not found");
        }

        if (term.is_closed || term.status === "closed" || term.status === "completed") {
          return {
            term: { ...term, status: "completed" },
            summary: { termClosed: true, gradesArchived: 0, balancesCarriedForward: 0, studentsProcessed: 0, feeStructuresUpdated: 0, alreadyClosed: true },
          };
        }

        const summary = {
          termClosed: false,
          gradesArchived: 0,
          balancesCarriedForward: 0,
          studentsProcessed: 0,
          feeStructuresUpdated: 0,
        };

        await database.update(
          "terms",
          { status: "completed", is_current: false, is_closed: true },
          { term_id: termId, school_id: schoolId }
        );
        summary.termClosed = true;

        if (archiveGrades) {
          const { data: grades } = await database.query("grades", {
            where: { school_id: schoolId, term: term.term_name },
          });

          if (grades && grades.length > 0) {
            await database.update(
              "grades",
              { is_archived: true, archived_at: new Date().toISOString(), archived_term_id: termId },
              { school_id: schoolId, term: term.term_name }
            );
            summary.gradesArchived = grades.length;
          }
        }

        if (carryForwardBalances) {
          const { data: students } = await database.query("students", {
            where: { school_id: schoolId, status: "active" },
          });

          const { data: feeStructures } = await database.query("fee_structures", {
            where: { school_id: schoolId, term: term.term_name },
          });

          const { data: payments } = await supabase
            .from("payments")
            .select("*")
            .eq("school_id", schoolId)
            .eq("term", term.term_name)
            .in("status", ["paid", "completed", "success"])
            .eq("is_deleted", false);
          const schoolSettings = await getSchoolSettings(schoolId);

          if (students && students.length > 0) {
            let balanceCount = 0;
            for (const student of students) {
              const balanceInfo = calculateStudentFeeBalance({
                student,
                feeStructures: feeStructures || [],
                payments: payments || [],
                schoolSettings,
              });

              if (balanceInfo.balance > 0) {
                await database.update(
                  "students",
                  { opening_balance: balanceInfo.balance, opening_balance_type: "owing", opening_balance_term: term.term_name, updated_at: new Date().toISOString() },
                  { student_id: student.student_id }
                );
                balanceCount++;
              } else if (balanceInfo.isOverpaid) {
                await database.update(
                  "students",
                  { opening_balance: balanceInfo.overpaymentAmount, opening_balance_type: "credit", opening_balance_term: term.term_name, updated_at: new Date().toISOString() },
                  { student_id: student.student_id }
                );
                balanceCount++;
              }
            }
            summary.balancesCarriedForward = balanceCount;
            summary.studentsProcessed = students.length;
          }
        }

        const nextTermToActivate = nextTermId || await this.findNextTerm(schoolId, termId);
        if (nextTermToActivate) {
          await this.activateTerm(schoolId, nextTermToActivate, userId);

          const { data: currentFeeStructures } = await database.query("fee_structures", {
            where: { school_id: schoolId, term: term.term_name },
          });

          if (currentFeeStructures && currentFeeStructures.length > 0) {
            const nextTerm = await this.getTerm(schoolId, nextTermToActivate);
            if (nextTerm) {
              for (const feeStruct of currentFeeStructures) {
                const { data: existing } = await database.query("fee_structures", {
                  where: { class_name: feeStruct.class_name, term: nextTerm.term_name, school_id: schoolId },
                  limit: 1,
                });

                if (!existing || existing.length === 0) {
                  await database.insert("fee_structures", {
                    school_id: schoolId,
                    class_name: feeStruct.class_name,
                    term: nextTerm.term_name,
                    tuition: feeStruct.tuition,
                    activity: feeStruct.activity,
                    misc: feeStruct.misc,
                    created_at: new Date().toISOString(),
                  });
                  summary.feeStructuresUpdated++;
                }
              }
            }
          }
        }

        await logAuditEvent({ user: { userId, schoolId } }, {
          action: "term.transition",
          entity: "terms",
          entityId: termId,
          description: `Ended term ${term.term_name} and prepared for transition`,
          metadata: summary,
        });

        return {
          term: { ...term, status: "closed" },
          summary: { ...summary, promoted: summary.studentsProcessed },
        };
      } catch (error) {
        console.error("End term transition error:", error);
        throw error;
      }
    });
  }
}

export default TermService;
