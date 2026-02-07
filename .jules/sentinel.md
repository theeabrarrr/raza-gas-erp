# Sentinel Journal

## 2026-02-07 - Silent Failure of Security Logging
**Vulnerability:** Security audit logging code existed and was being called, but the underlying database table `security_audit_logs` was missing. This caused security events (like cross-tenant access attempts) to be swallowed silently.
**Learning:** Checking for code existence is not enough; infrastructure dependencies (DB tables) must be verified. The try-catch block in the logger hid the missing table error.
**Prevention:** Always verify schema migrations exist for any database-interacting code. Add health checks or startup checks that verify critical tables exist.
