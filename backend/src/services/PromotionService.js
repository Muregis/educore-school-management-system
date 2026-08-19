import { database } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";
import { logAuditEvent } from "../helpers/audit.logger.js";
import GradeCalculationService from "./GradeCalculationService.js";

const PROMOTION_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function generatePromotionIdempotencyKey(schoolId, fromClass, toClass, studentIds, dryRun) {
  const ids = Array.isArray(studentIds) ? studentIds.slice().sort().join(",") : "all";
  return `promotion:${schoolId}:${fromClass}:${toClass}:${ids}:${dryRun}`;
}

async function withPromotionIdempotencyGuard(schoolId, fromClass, toClass, studentIds, dryRun, fn) {
  const key = generatePromotionIdempotencyKey(schoolId, fromClass, toClass, studentIds, dryRun);
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("idempotency_keys")
      .select("response_payload, created_at")
      .eq("key", key)
      .maybeSingle();

    if (fetchError) {
      console.error("Promotion idempotency guard fetch failed:", fetchError.message);
    } else if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime();
      if (age < PROMOTION_IDEMPOTENCY_TTL_MS && existing.response_payload) {
        return existing.response_payload;
      }
    }
  } catch (guardError) {
    console.error("Promotion idempotency guard read failed:", guardError);
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
    console.error("Promotion idempotency guard write failed:", guardError);
  }

  return result;
}

export class PromotionService {
  static async promoteStudents(schoolId, fromClass, toClass, academicYear, options = {}) {
    const { dryRun = false, autoApprove = false, userId = null, minPercentage = null } = options;

    return withPromotionIdempotencyGuard(schoolId, fromClass, toClass, null, dryRun, async () => {
      try {
        const { data: students } = await database.query("students", {
          where: {
            school_id: schoolId,
            class_name: fromClass,
            status: "active",
            is_deleted: false,
          },
        });

        if (!students || students.length === 0) {
          return {
            success: true,
            promoted: 0,
            skipped: 0,
            errors: [],
            message: "No students found to promote",
          };
        }

        const promoted = [];
        const skipped = [];
        const errors = [];

        for (const student of students) {
          try {
            const canPromote = await this.checkPromotionCriteria(schoolId, student.student_id, fromClass, toClass, minPercentage, academicYear);

            if (!canPromote.canPromote) {
              skipped.push({
                studentId: student.student_id,
                name: `${student.first_name} ${student.last_name}`.trim(),
                reason: canPromote.reason,
              });
              continue;
            }

            if (!dryRun) {
              await database.update(
                "students",
                {
                  class_name: toClass,
                  previous_class: fromClass,
                  promotion_year: academicYear,
                  updated_at: new Date().toISOString(),
                },
                { student_id: student.student_id, school_id: schoolId }
              );

              await this.createEnrollmentHistory(schoolId, student.student_id, null, fromClass, toClass, academicYear, "promoted");

              promoted.push({
                studentId: student.student_id,
                name: `${student.first_name} ${student.last_name}`.trim(),
                fromClass,
                toClass,
              });
            } else {
              promoted.push({
                studentId: student.student_id,
                name: `${student.first_name} ${student.last_name}`.trim(),
                fromClass,
                toClass,
                wouldPromote: true,
              });
            }
          } catch (error) {
            errors.push({
              studentId: student.student_id,
              error: error.message,
            });
          }
        }

        if (!dryRun && userId) {
          await logAuditEvent({ user: { userId, schoolId } }, {
            action: "students.promote",
            entity: "promotion_batch",
            description: `Promoted ${promoted.length} students from ${fromClass} to ${toClass}. Skipped: ${skipped.length}. Errors: ${errors.length}`,
            metadata: { fromClass, toClass, promoted: promoted.length, skipped: skipped.length, errors: errors.length },
          });
        }

        return {
          success: errors.length === 0,
          promoted: promoted.length,
          skipped: skipped.length,
          errors,
          promotedStudents: promoted,
          skippedStudents: skipped,
          dryRun,
          message: this.generatePromotionMessage(promoted.length, skipped.length, errors.length, dryRun),
        };
      } catch (error) {
        console.error("Promote students error:", error);
        throw error;
      }
    });
  }

  static async promoteStudent(studentId, toClass, userId, reason = "Individual promotion") {
    try {
      const { data: student } = await database.query("students", {
        where: { student_id: studentId, is_deleted: false },
        limit: 1,
      });

      if (!student || student.length === 0) {
        throw new Error("Student not found");
      }

      const studentRecord = student[0];
      const fromClass = studentRecord.class_name;

      if (!fromClass) {
        throw new Error("Student does not have a current class assigned");
      }

      await database.update(
        "students",
        {
          class_name: toClass,
          previous_class: fromClass,
          promotion_year: new Date().getFullYear().toString(),
          updated_at: new Date().toISOString(),
        },
        { student_id: studentId }
      );

      await this.createEnrollmentHistory(studentRecord.school_id, studentId, null, fromClass, toClass, new Date().getFullYear().toString(), "promoted");

      await logAuditEvent({ user: { userId, schoolId: studentRecord.school_id } }, {
        action: "students.promote.individual",
        entity: "students",
        entityId: studentId,
        description: `${reason}: ${fromClass} → ${toClass}`,
      });

      return {
        success: true,
        studentId,
        fromClass,
        toClass,
        message: `Student promoted from ${fromClass} to ${toClass}`,
      };
    } catch (error) {
      console.error("Promote single student error:", error);
      throw error;
    }
  }

  static async checkPromotionCriteria(schoolId, studentId, fromClass, toClass, minPercentage = null, academicYear = null) {
    try {
      const { data: student } = await database.query("students", {
        where: { student_id: studentId, school_id: schoolId, is_deleted: false },
        limit: 1,
      });

      if (!student || student.length === 0) {
        return { canPromote: false, reason: "Student not found" };
      }

      const studentRecord = student[0];

      if (studentRecord.status !== "active") {
        return { canPromote: false, reason: "Student is not active" };
      }

      if (studentRecord.class_name !== fromClass) {
        return { canPromote: false, reason: `Student is in ${studentRecord.class_name}, not ${fromClass}` };
      }

      if (minPercentage !== null && academicYear) {
        const currentTerm = await (await import("./TermService.js")).TermService.getCurrentTerm(schoolId);
        const termName = currentTerm?.term_name || "Term 3";

        const meanResult = await GradeCalculationService.calculateMeanGrade(schoolId, studentId, termName, new Date().getFullYear());

        if (meanResult.meanPoints < minPercentage) {
          return {
            canPromote: false,
            reason: `Mean grade ${meanResult.meanPoints}% is below minimum required ${minPercentage}%`,
          };
        }
      }

      const { data: unpaidPayments } = await database.query("payments", {
        where: {
          student_id: studentId,
          school_id: schoolId,
          status: { in: "('pending','failed')" },
          is_deleted: false,
        },
        limit: 1,
      });

      if (unpaidPayments && unpaidPayments.length > 0) {
        return { canPromote: false, reason: "Student has unpaid fee balances" };
      }

      return { canPromote: true, reason: "Eligible for promotion" };
    } catch (error) {
      console.error("Check promotion criteria error:", error);
      return { canPromote: false, reason: "Error checking criteria" };
    }
  }

  static async getNextClass(currentClass, schoolId = null) {
    try {
      if (schoolId) {
        const { data: config } = await database.query("school_settings", {
          where: {
            school_id: schoolId,
            setting_key: "class_progression",
          },
          limit: 1,
        });

        if (config && config.length > 0) {
          const progression = JSON.parse(config[0].setting_value || "{}");
          return progression[currentClass] || null;
        }
      }

      const defaultProgression = {
        Playgroup: "PP1",
        PP1: "PP2",
        PP2: "Grade 1",
        "Grade 1": "Grade 2",
        "Grade 2": "Grade 3",
        "Grade 3": "Grade 4",
        "Grade 4": "Grade 5",
        "Grade 5": "Grade 6",
        "Grade 6": "Grade 7",
        "Grade 7": "Grade 8",
        "Grade 8": "Grade 9",
        "Grade 9": "Form 1",
      };

      return defaultProgression[currentClass] || null;
    } catch (error) {
      console.error("Get next class error:", error);
      return null;
    }
  }

  static async createEnrollmentHistory(schoolId, studentId, fromClassId, fromClassName, toClassName, academicYear, action) {
    try {
      await logAuditEvent({ user: { schoolId } }, {
        action: `student.${action}`,
        entity: "enrollment_history",
        entityId: studentId,
        description: `${action}: ${fromClassName} → ${toClassName} (${academicYear})`,
      });
    } catch (error) {
      console.error("Create enrollment history error:", error);
    }
  }

  static async getPromotionRules(schoolId) {
    try {
      const { data: config } = await database.query("school_settings", {
        where: {
          school_id: schoolId,
          setting_key: "promotion_rules",
        },
        limit: 1,
      });

      if (config && config.length > 0) {
        return JSON.parse(config[0].setting_value || "{}");
      }

      return {
        progression: {
          Playgroup: "PP1",
          PP1: "PP2",
          PP2: "Grade 1",
          "Grade 1": "Grade 2",
          "Grade 2": "Grade 3",
          "Grade 3": "Grade 4",
          "Grade 4": "Grade 5",
          "Grade 5": "Grade 6",
          "Grade 6": "Grade 7",
          "Grade 7": "Grade 8",
          "Grade 8": "Grade 9",
          "Grade 9": "Form 1",
        },
        requirements: {
          minimumPercentage: 50,
          clearFees: true,
          goodStanding: true,
        },
      };
    } catch (error) {
      console.error("Get promotion rules error:", error);
      return null;
    }
  }

  generatePromotionMessage(promoted, skipped, errors, dryRun) {
    if (dryRun) {
      return `Dry run: ${promoted} student(s) would be promoted, ${skipped} would be skipped`;
    }

    let message = `${promoted} student(s) promoted successfully`;
    if (skipped > 0) message += `, ${skipped} skipped`;
    if (errors > 0) message += `, ${errors} errors`;

    return message;
  }
}

export default PromotionService;
