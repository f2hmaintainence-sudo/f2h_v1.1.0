CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id              INT   PRIMARY KEY ,
  admin_id        VARCHAR       NOT NULL,
  admin_name      VARCHAR(200)  DEFAULT NULL,
  action          VARCHAR(50)   NOT NULL,
  target_type   VARCHAR(50)   NOT NULL,
  target_id     VARCHAR       DEFAULT NULL,
  details         JSONB         DEFAULT '{}'::jsonb,
  ip_address      VARCHAR(50)   DEFAULT NULL,
  user_agent      TEXT          DEFAULT NULL,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin
  ON admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON admin_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON admin_audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date
  ON admin_audit_logs (created_at DESC);