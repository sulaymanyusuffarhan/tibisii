-- Phase 2: tighten identity and authorization invariants.
-- Existing IDs and role mappings are retained; this migration is additive.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_casefold_unique ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_reset_tokens_active ON password_reset_tokens (user_id, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits (reset_at);
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users (role_id, is_active);

ALTER TABLE roles
  ADD CONSTRAINT roles_permissions_is_array CHECK (jsonb_typeof(permissions) = 'array');

ALTER TABLE users
  ADD CONSTRAINT users_login_attempts_nonnegative CHECK (failed_login_attempts >= 0);

ALTER TABLE sessions
  ADD CONSTRAINT sessions_csrf_nonempty CHECK (length(csrf_token) >= 32);

ALTER TABLE password_reset_tokens
  ADD CONSTRAINT password_reset_token_hash_length CHECK (length(token_hash) = 64);

-- Expired reset links/sessions are cleaned periodically opportunistically by application code.
