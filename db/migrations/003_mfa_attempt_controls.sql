ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_locked_until TIMESTAMPTZ;
ALTER TABLE users ADD CONSTRAINT users_mfa_attempts_nonnegative CHECK (mfa_failed_attempts >= 0);
CREATE INDEX IF NOT EXISTS idx_users_mfa_lock ON users (mfa_locked_until) WHERE mfa_locked_until IS NOT NULL;
