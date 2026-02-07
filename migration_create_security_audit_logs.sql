-- Create Security Audit Logs Table
-- Matches schema expected by src/lib/utils/auditLogger.ts
-- Specified in SECURITY_FIX.md Section 6.2

SET search_path = public;

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid REFERENCES users(id),
  target_resource text,
  tenant_id uuid,
  attempted_tenant_id uuid,
  action text,
  timestamp timestamp with time zone NOT NULL,
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_audit_logs(event_type);
