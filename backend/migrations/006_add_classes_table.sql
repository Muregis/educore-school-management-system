-- Create classes table if it doesn't exist
CREATE TABLE IF NOT EXISTS classes (
  class_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  class_name VARCHAR(100) NOT NULL,
  next_class_name VARCHAR(100),
  stream VARCHAR(50),
  capacity INTEGER DEFAULT 40,
  class_teacher_id UUID REFERENCES teachers(teacher_id),
  academic_year VARCHAR(20),
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(school_id, class_name, is_deleted)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_class_name ON classes(class_name);
CREATE INDEX IF NOT EXISTS idx_classes_school_class ON classes(school_id, class_name) WHERE is_deleted = FALSE;

-- Add comment
COMMENT ON TABLE classes IS 'Stores class information including promotion chain configuration';
COMMENT ON COLUMN classes.next_class_name IS 'The class students will be promoted to next term';
