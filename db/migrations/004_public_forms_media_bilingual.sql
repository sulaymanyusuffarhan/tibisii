-- Phase 5/6: public submissions, private-by-default media, and approved agency identity.
ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_media_public_created ON media_assets(is_public, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_checksum_unique
  ON media_assets(checksum_sha256) WHERE checksum_sha256 <> '' AND is_deleted = FALSE;

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_notice_version TEXT NOT NULL DEFAULT '2026-02-v1';

CREATE INDEX IF NOT EXISTS idx_submissions_reference ON form_submissions(reference_number);
CREATE INDEX IF NOT EXISTS idx_submissions_status_priority ON form_submissions(status, priority, created_at DESC);

-- Replace only the original bundled artwork-slot paths with the image files supplied for this release.
-- Preserve independently configured artwork; replacing these defaults does not certify broader eGA compliance.
UPDATE site_settings
SET value_json = value_json || jsonb_build_object(
  'institutional_logo_url', '/branding/tbc-logo.webp',
  'national_emblem_url', '/branding/tanzania-emblem.png',
  'verified', FALSE
), updated_at = NOW()
WHERE key = 'branding'
  AND value_json->>'institutional_logo_url' = '/branding/tbc-logo.svg'
  AND value_json->>'national_emblem_url' = '/branding/tz-coat-of-arms.svg';
