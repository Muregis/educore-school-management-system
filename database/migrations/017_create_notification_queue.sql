-- Migration: Create notification_queue for automated SMS/push notifications
-- Enables fee reminders and bulk messaging to parents

CREATE TABLE IF NOT EXISTS notification_queue (
  queue_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('parent', 'student', 'teacher', 'all')),
  message TEXT NOT NULL,
  channel VARCHAR(10) CHECK (channel IN ('sms', 'whatsapp', 'email', 'push')),
  scheduled_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_school ON notification_queue(school_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_channel ON notification_queue(channel);

-- RLS for tenant isolation
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_queue_school_isolation ON notification_queue
  FOR ALL
  USING (school_id = current_setting('app.current_school_id')::BIGINT);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_notification_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_queue_timestamp_trigger
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_queue_timestamp();

COMMENT ON TABLE notification_queue IS 'Queue for automated notifications (SMS, WhatsApp, email)';
COMMENT ON COLUMN notification_queue.metadata IS 'Additional data like student_id, amount, etc.';
