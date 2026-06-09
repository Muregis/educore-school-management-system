-- RLS Policies for HR Tables (hr_staff, hr_leave, hr_attendance, hr_payslips)

-- Enable RLS on all HR tables
ALTER TABLE public.hr_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payslips ENABLE ROW LEVEL SECURITY;

-- hr_staff policies
CREATE POLICY tenant_isolation_hr_staff ON public.hr_staff
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id)
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY select_hr_staff ON public.hr_staff FOR SELECT
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY insert_hr_staff ON public.hr_staff FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY update_hr_staff ON public.hr_staff FOR UPDATE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY delete_hr_staff ON public.hr_staff FOR DELETE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- hr_leave policies
CREATE POLICY tenant_isolation_hr_leave ON public.hr_leave
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id)
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY select_hr_leave ON public.hr_leave FOR SELECT
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY insert_hr_leave ON public.hr_leave FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY update_hr_leave ON public.hr_leave FOR UPDATE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY delete_hr_leave ON public.hr_leave FOR DELETE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- hr_attendance policies
CREATE POLICY tenant_isolation_hr_attendance ON public.hr_attendance
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id)
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY select_hr_attendance ON public.hr_attendance FOR SELECT
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY insert_hr_attendance ON public.hr_attendance FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY update_hr_attendance ON public.hr_attendance FOR UPDATE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY delete_hr_attendance ON public.hr_attendance FOR DELETE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

-- hr_payslips policies
CREATE POLICY tenant_isolation_hr_payslips ON public.hr_payslips
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id)
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY select_hr_payslips ON public.hr_payslips FOR SELECT
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY insert_hr_payslips ON public.hr_payslips FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY update_hr_payslips ON public.hr_payslips FOR UPDATE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);

CREATE POLICY delete_hr_payslips ON public.hr_payslips FOR DELETE
  USING ((auth.jwt() ->> 'school_id')::bigint = school_id);
