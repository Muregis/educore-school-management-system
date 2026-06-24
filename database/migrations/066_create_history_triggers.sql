-- Create triggers for history logging
CREATE OR REPLACE FUNCTION log_student_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO students_history (student_id, school_id, operation, new_values, changed_by, version)
        VALUES (NEW.id, NEW.school_id, 'INSERT', to_jsonb(NEW), NEW.created_by, NEW.version);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO students_history (student_id, school_id, operation, old_values, new_values, changed_by, version)
        VALUES (NEW.id, NEW.school_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.updated_by, NEW.version);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO students_history (student_id, school_id, operation, old_values, changed_by, version)
        VALUES (OLD.id, OLD.school_id, 'DELETE', to_jsonb(OLD), OLD.deleted_by, OLD.version);
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_student_history ON students;
CREATE TRIGGER trigger_student_history
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION log_student_history();
