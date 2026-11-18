-- =============================================================================
-- TBC Corporate Communication Website & CMS
-- Migration 001: Initial PostgreSQL Schema
-- Compatible with PostgreSQL 15+ and PGlite (embedded PostgreSQL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. ROLES & CONFIGURABLE PERMISSIONS
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_sw TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ADMINISTRATIVE USERS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  delegated_publish BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT,
  mfa_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- 3. AUTHENTICATED SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 4. PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. WEBSITE SETTINGS & CONFIGURATION
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  group_name TEXT NOT NULL DEFAULT 'general',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. NAVIGATION MENUS (MAIN, DROPDOWNS, FOOTER, UTILITY)
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  location TEXT NOT NULL,
  parent_id TEXT REFERENCES menu_items(id) ON DELETE CASCADE,
  label_sw TEXT NOT NULL,
  label_en TEXT NOT NULL,
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  is_external BOOLEAN NOT NULL DEFAULT FALSE,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_location_order ON menu_items(location, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_parent ON menu_items(parent_id);

-- 7. HOMEPAGE CONFIGURABLE SECTIONS & BANNERS
CREATE TABLE IF NOT EXISTS homepage_sections (
  id TEXT PRIMARY KEY,
  section_key TEXT NOT NULL,
  section_type TEXT NOT NULL,
  title_sw TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  subtitle_sw TEXT NOT NULL DEFAULT '',
  subtitle_en TEXT NOT NULL DEFAULT '',
  body_sw TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  cta_label_sw TEXT NOT NULL DEFAULT '',
  cta_label_en TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  secondary_cta_label_sw TEXT NOT NULL DEFAULT '',
  secondary_cta_label_en TEXT NOT NULL DEFAULT '',
  secondary_cta_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt_sw TEXT NOT NULL DEFAULT '',
  image_alt_en TEXT NOT NULL DEFAULT '',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homepage_order ON homepage_sections(sort_order);

-- 8. CATEGORIES & TAGS
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  module TEXT NOT NULL,
  name_sw TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module, slug)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_sw TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. CENTRALIZED MEDIA LIBRARY
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  media_type TEXT NOT NULL,
  title_sw TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  caption_sw TEXT NOT NULL DEFAULT '',
  caption_en TEXT NOT NULL DEFAULT '',
  alt_sw TEXT NOT NULL DEFAULT '',
  alt_en TEXT NOT NULL DEFAULT '',
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  external_video_url TEXT NOT NULL DEFAULT '',
  is_gallery_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  scan_status TEXT NOT NULL DEFAULT 'validated_no_av',
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  replaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_type ON media_assets(media_type);
CREATE INDEX IF NOT EXISTS idx_media_category ON media_assets(category);
CREATE INDEX IF NOT EXISTS idx_media_gallery ON media_assets(is_gallery_featured);

-- 10. INSTITUTIONAL & VISUAL-BUILDER PAGES
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  section_group TEXT NOT NULL DEFAULT 'custom',
  template TEXT NOT NULL DEFAULT 'institutional',
  title_sw TEXT NOT NULL,
  summary_sw TEXT NOT NULL DEFAULT '',
  body_sw TEXT NOT NULL DEFAULT '',
  seo_title_sw TEXT NOT NULL DEFAULT '',
  seo_description_sw TEXT NOT NULL DEFAULT '',
  status_sw TEXT NOT NULL DEFAULT 'published',
  title_en TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  status_en TEXT NOT NULL DEFAULT 'draft',
  hero_image_url TEXT NOT NULL DEFAULT '',
  hero_image_alt_sw TEXT NOT NULL DEFAULT '',
  hero_image_alt_en TEXT NOT NULL DEFAULT '',
  blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  workflow_status TEXT NOT NULL DEFAULT 'draft',
  review_notes TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pages_group ON pages(section_group, sort_order);
CREATE INDEX IF NOT EXISTS idx_pages_workflow ON pages(workflow_status);

-- 11. EDITORIAL ARTICLES & INSTITUTIONAL STORIES
-- Modules: announcement, behind_scenes, community, hospitality, achievement, partnership, video
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'article',
  category_slug TEXT NOT NULL DEFAULT 'general',
  title_sw TEXT NOT NULL,
  excerpt_sw TEXT NOT NULL DEFAULT '',
  body_sw TEXT NOT NULL DEFAULT '',
  seo_title_sw TEXT NOT NULL DEFAULT '',
  seo_description_sw TEXT NOT NULL DEFAULT '',
  status_sw TEXT NOT NULL DEFAULT 'published',
  title_en TEXT NOT NULL DEFAULT '',
  excerpt_en TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  status_en TEXT NOT NULL DEFAULT 'draft',
  featured_image_url TEXT NOT NULL DEFAULT '',
  featured_image_alt_sw TEXT NOT NULL DEFAULT '',
  featured_image_alt_en TEXT NOT NULL DEFAULT '',
  featured_image_caption_sw TEXT NOT NULL DEFAULT '',
  featured_image_caption_en TEXT NOT NULL DEFAULT '',
  gallery_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT NOT NULL DEFAULT '',
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_publication_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_date DATE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  workflow_status TEXT NOT NULL DEFAULT 'draft',
  review_notes TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_module_status ON articles(module, workflow_status);
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- 12. EVENTS & INSTITUTIONAL ACTIVITIES (YALIYOJIRI)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_slug TEXT NOT NULL DEFAULT 'corporate_activity',
  title_sw TEXT NOT NULL,
  summary_sw TEXT NOT NULL DEFAULT '',
  description_sw TEXT NOT NULL DEFAULT '',
  seo_title_sw TEXT NOT NULL DEFAULT '',
  seo_description_sw TEXT NOT NULL DEFAULT '',
  status_sw TEXT NOT NULL DEFAULT 'published',
  title_en TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  status_en TEXT NOT NULL DEFAULT 'draft',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location_sw TEXT NOT NULL DEFAULT '',
  location_en TEXT NOT NULL DEFAULT '',
  participants_sw TEXT NOT NULL DEFAULT '',
  participants_en TEXT NOT NULL DEFAULT '',
  featured_image_url TEXT NOT NULL DEFAULT '',
  featured_image_alt_sw TEXT NOT NULL DEFAULT '',
  featured_image_alt_en TEXT NOT NULL DEFAULT '',
  featured_image_caption_sw TEXT NOT NULL DEFAULT '',
  featured_image_caption_en TEXT NOT NULL DEFAULT '',
  gallery_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  videos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_publication_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived_event BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  workflow_status TEXT NOT NULL DEFAULT 'draft',
  review_notes TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(workflow_status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_slug);

-- 13. PUBLICATIONS & DIGITAL DOCUMENT LIBRARY (MACHAPISHO NA TAARIFA)
CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_slug TEXT NOT NULL,
  reference_number TEXT NOT NULL DEFAULT '',
  publication_date DATE NOT NULL,
  document_language TEXT NOT NULL DEFAULT 'sw',
  title_sw TEXT NOT NULL,
  description_sw TEXT NOT NULL DEFAULT '',
  seo_title_sw TEXT NOT NULL DEFAULT '',
  seo_description_sw TEXT NOT NULL DEFAULT '',
  status_sw TEXT NOT NULL DEFAULT 'published',
  title_en TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  seo_title_en TEXT NOT NULL DEFAULT '',
  seo_description_en TEXT NOT NULL DEFAULT '',
  status_en TEXT NOT NULL DEFAULT 'draft',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  thumbnail_alt_sw TEXT NOT NULL DEFAULT '',
  thumbnail_alt_en TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  workflow_status TEXT NOT NULL DEFAULT 'draft',
  review_notes TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publications_cat_status ON publications(category_slug, workflow_status);
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(publication_date DESC);

-- 14. LEADERSHIP, BOARD & HISTORICAL DIRECTORS GENERAL
CREATE TABLE IF NOT EXISTS leadership_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  group_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  portrait_url TEXT NOT NULL DEFAULT '',
  portrait_alt_sw TEXT NOT NULL DEFAULT '',
  portrait_alt_en TEXT NOT NULL DEFAULT '',
  position_sw TEXT NOT NULL,
  position_en TEXT NOT NULL,
  period_of_service TEXT NOT NULL DEFAULT '',
  service_order INTEGER NOT NULL DEFAULT 0,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  short_bio_sw TEXT NOT NULL DEFAULT '',
  short_bio_en TEXT NOT NULL DEFAULT '',
  background_sw TEXT NOT NULL DEFAULT '',
  background_en TEXT NOT NULL DEFAULT '',
  achievements_sw TEXT NOT NULL DEFAULT '',
  achievements_en TEXT NOT NULL DEFAULT '',
  additional_info_sw TEXT NOT NULL DEFAULT '',
  additional_info_en TEXT NOT NULL DEFAULT '',
  status_sw TEXT NOT NULL DEFAULT 'published',
  status_en TEXT NOT NULL DEFAULT 'published',
  workflow_status TEXT NOT NULL DEFAULT 'published',
  is_placeholder BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadership_group ON leadership_profiles(group_type, sort_order);

-- 15. BROADCAST SERVICES (RADIO, TV, DIGITAL) & PROGRAMME SCHEDULES
CREATE TABLE IF NOT EXISTS broadcast_channels (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  service_type TEXT NOT NULL,
  name_sw TEXT NOT NULL,
  name_en TEXT NOT NULL,
  tagline_sw TEXT NOT NULL DEFAULT '',
  tagline_en TEXT NOT NULL DEFAULT '',
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  frequencies_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  coverage_sw TEXT NOT NULL DEFAULT '',
  coverage_en TEXT NOT NULL DEFAULT '',
  location_sw TEXT NOT NULL DEFAULT '',
  location_en TEXT NOT NULL DEFAULT '',
  distribution_platforms_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_programmes (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES broadcast_channels(id) ON DELETE CASCADE,
  title_sw TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  presenter_sw TEXT NOT NULL DEFAULT '',
  presenter_en TEXT NOT NULL DEFAULT '',
  broadcast_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  category_sw TEXT NOT NULL DEFAULT '',
  category_en TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'sw',
  workflow_status TEXT NOT NULL DEFAULT 'published',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programmes_channel ON broadcast_programmes(channel_id, start_time);

-- 16. TBC PRODUCTION TEAM SPOTLIGHT (PERSONNEL PROFILES)
CREATE TABLE IF NOT EXISTS personnel_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  photo_alt_sw TEXT NOT NULL DEFAULT '',
  photo_alt_en TEXT NOT NULL DEFAULT '',
  role_category TEXT NOT NULL,
  job_title_sw TEXT NOT NULL,
  job_title_en TEXT NOT NULL,
  department_sw TEXT NOT NULL DEFAULT '',
  department_en TEXT NOT NULL DEFAULT '',
  bio_sw TEXT NOT NULL DEFAULT '',
  bio_en TEXT NOT NULL DEFAULT '',
  expertise_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  programmes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements_sw TEXT NOT NULL DEFAULT '',
  achievements_en TEXT NOT NULL DEFAULT '',
  video_interview_url TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_placeholder BOOLEAN NOT NULL DEFAULT TRUE,
  status_sw TEXT NOT NULL DEFAULT 'published',
  status_en TEXT NOT NULL DEFAULT 'published',
  workflow_status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personnel_category ON personnel_profiles(role_category, workflow_status);

-- 17. STAKEHOLDERS' VOICE / TESTIMONIALS (STRICT MODERATION QUEUE)
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  submitter_name TEXT NOT NULL,
  submitter_role_or_org TEXT NOT NULL DEFAULT '',
  submitter_region TEXT NOT NULL DEFAULT '',
  submitter_email TEXT NOT NULL DEFAULT '',
  submitter_phone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'stakeholder',
  quote_sw TEXT NOT NULL DEFAULT '',
  quote_en TEXT NOT NULL DEFAULT '',
  original_language TEXT NOT NULL DEFAULT 'sw',
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  moderator_notes TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_ip TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(moderation_status);

-- 18. REGIONAL OFFICES & CONTACTS (OFISI ZA KANDA)
CREATE TABLE IF NOT EXISTS regional_offices (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  zone_sw TEXT NOT NULL DEFAULT '',
  zone_en TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL,
  office_name_sw TEXT NOT NULL,
  office_name_en TEXT NOT NULL,
  is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
  manager_name TEXT NOT NULL DEFAULT '',
  manager_photo_url TEXT NOT NULL DEFAULT '',
  physical_address_sw TEXT NOT NULL DEFAULT '',
  physical_address_en TEXT NOT NULL DEFAULT '',
  building_number TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  po_box TEXT NOT NULL DEFAULT '',
  telephone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT -6.7924,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 39.2083,
  description_sw TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  stations_covered_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_placeholder BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offices_region ON regional_offices(region, sort_order);

-- 19. FREQUENTLY ASKED QUESTIONS (MASWALI YA MARA KWA MARA)
CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  category_sw TEXT NOT NULL DEFAULT 'Jumla',
  category_en TEXT NOT NULL DEFAULT 'General',
  question_sw TEXT NOT NULL,
  answer_sw TEXT NOT NULL,
  question_en TEXT NOT NULL DEFAULT '',
  answer_en TEXT NOT NULL DEFAULT '',
  status_sw TEXT NOT NULL DEFAULT 'published',
  status_en TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. PUBLIC FORM SUBMISSIONS & ENQUIRIES (ALL 9 FORM TYPES)
CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  form_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  regional_office_id TEXT REFERENCES regional_offices(id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  language TEXT NOT NULL DEFAULT 'sw',
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  internal_notes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_notification_status TEXT NOT NULL DEFAULT 'not_configured',
  ip_address TEXT NOT NULL DEFAULT '',
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_type_status ON form_submissions(form_type, status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON form_submissions(created_at DESC);

-- 21. EDITORIAL WORKFLOW HISTORY
CREATE TABLE IF NOT EXISTS workflow_history (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_entity ON workflow_history(entity_type, entity_id, created_at DESC);

-- 22. ADMINISTRATIVE AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL DEFAULT '',
  user_role TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- 23. STORED ANALYTICS EVENTS (PRIVACY-PRESERVING)
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'sw',
  session_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_path ON analytics_events(path);

-- 24. SERVER-SIDE RATE LIMITING
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);
