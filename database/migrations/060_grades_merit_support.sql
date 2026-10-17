-- =============================================================================
-- EduCore: Grades / Merit list support (safe, additive)
-- Run in Supabase SQL editor against production when ready.
-- Does NOT delete or rewrite existing marks.
-- =============================================================================

-- 1) results: ensure columns used by analysis + merit
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS class_id BIGINT,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exam_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);

UPDATE public.results SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE public.results SET total_marks = 100 WHERE total_marks IS NULL OR total_marks <= 0;

-- 2) classes: stream/section for Blue/Green/Purple chips
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS section VARCHAR(40),
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

UPDATE public.classes SET is_deleted = FALSE WHERE is_deleted IS NULL;
UPDATE public.classes SET status = 'active' WHERE status IS NULL OR status = '';

-- 3) Indexes for merit queries (school + term scoped)
CREATE INDEX IF NOT EXISTS idx_results_school_term
  ON public.results (school_id, term)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_results_school_student
  ON public.results (school_id, student_id)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_results_school_class
  ON public.results (school_id, class_id)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_classes_school_name
  ON public.classes (school_id, class_name)
  WHERE COALESCE(is_deleted, false) = false;

-- 4) Optional: exam_sessions (Phase B ready — not required for term-based merit)
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  exam_session_id BIGSERIAL PRIMARY KEY,
  school_id       BIGINT NOT NULL REFERENCES public.schools(school_id),
  name            VARCHAR(120) NOT NULL,
  term            VARCHAR(40),
  academic_year   VARCHAR(20),
  exam_type       VARCHAR(40) DEFAULT 'CAT',
  status          VARCHAR(20) DEFAULT 'active',
  starts_on       DATE,
  ends_on         DATE,
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_school
  ON public.exam_sessions (school_id)
  WHERE COALESCE(is_deleted, false) = false;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS exam_session_id BIGINT;

-- 5) Sanity checks (read-only examples)
-- SELECT COUNT(*) FROM results WHERE school_id = <id> AND COALESCE(is_deleted,false)=false;
-- SELECT class_name, section, COUNT(*) FROM classes WHERE school_id = <id> GROUP BY 1,2;
