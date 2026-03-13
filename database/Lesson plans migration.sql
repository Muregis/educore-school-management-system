-- ── Lesson Plans & Schemes of Work ───────────────────────────────────────────
-- Run once. Safe to re-run.

USE educore_db;

CREATE TABLE IF NOT EXISTS lesson_plans (
 plan_id         BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
school_id       BIGINT UNSIGNED  NOT NULL,
teacher_id      BIGINT UNSIGNED  NOT NULL,   -- users.user_id
type            ENUM('lesson_plan','scheme')  NOT NULL DEFAULT 'lesson_plan',

-- Teacher inputs
subject         VARCHAR(80)      NOT NULL,
class_name      VARCHAR(40)      NOT NULL,
term            VARCHAR(20)      NOT NULL,
week            VARCHAR(10)      DEFAULT NULL,
topic           VARCHAR(160)     NOT NULL,
duration        VARCHAR(30)      DEFAULT NULL,

-- Content
content         LONGTEXT         NOT NULL,  -- full lesson plan text (teacher-edited)

-- AI analysis (filled when admin runs analyzer)
ai_score        TINYINT UNSIGNED DEFAULT NULL,   -- 0-100
ai_missing      TEXT             DEFAULT NULL,
ai_weak         TEXT             DEFAULT NULL,
ai_recommendations TEXT          DEFAULT NULL,
ai_feedback_draft  TEXT          DEFAULT NULL,   -- suggested feedback for teacher

-- Workflow
status          ENUM('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft',
admin_feedback  TEXT             DEFAULT NULL,
reviewed_by     BIGINT UNSIGNED  DEFAULT NULL,   -- users.user_id
reviewed_at     DATETIME         DEFAULT NULL,

created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
is_deleted      TINYINT(1)       NOT NULL DEFAULT 0,

INDEX idx_school_status   (school_id, status),
INDEX idx_teacher         (teacher_id),
INDEX idx_school_type     (school_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;