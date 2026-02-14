-- =====================================================
-- PERFORMANCE INDEXES - Missing indexes for frequently queried columns
-- =====================================================
-- Run this in Supabase SQL Editor after reviewing.
-- These indexes target the most common query patterns found in the codebase.
-- =====================================================

-- 1. supervisor_emails: queried 15+ times per request with ILIKE
-- Currently only has email as PRIMARY KEY (text) but ILIKE bypasses btree index.
-- This functional index enables fast case-insensitive lookups.
CREATE INDEX IF NOT EXISTS idx_supervisor_emails_email_lower
  ON supervisor_emails (LOWER(email));

-- 2. user_permissions: queried in every permission check
-- Existing indexes: idx_user_permissions_user (user_id), idx_user_permissions_permission (permission_code)
-- Missing: composite index for the exact query pattern WHERE user_id = X AND permission_code = Y
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_permission
  ON user_permissions (user_id, permission_code);

-- 3. profiles.email: used in getProfileWithFallback email fallback lookup
-- and in supervisor_emails JOIN on LOWER(email)
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON profiles (email);

-- 4. profiles.is_active: partial index for the frequent .eq('is_active', true) filter
-- Used in technician listings, user selectors, and assignment views
CREATE INDEX IF NOT EXISTS idx_profiles_is_active
  ON profiles (is_active) WHERE is_active = true;

-- 5. assignments.position_id + technician_id: for the nested join pattern
-- positions -> assignments -> profiles used in event detail queries
CREATE INDEX IF NOT EXISTS idx_assignments_position_technician
  ON assignments (position_id, technician_id);

-- =====================================================
-- DIAGNOSTIC: Find source of pg_timezone_names query
-- =====================================================
-- The Supabase Performance Advisor reports that
-- "SELECT name FROM pg_timezone_names" uses 21.5% of DB time.
-- This query checks if any custom function references it:

-- Check for functions that reference pg_timezone_names
SELECT proname, prosrc
FROM pg_proc
WHERE prosrc ILIKE '%pg_timezone_names%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Check for views that reference pg_timezone_names
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%pg_timezone_names%';

-- If both return empty, the query is likely coming from:
-- 1. Supabase Dashboard/Studio UI (common source)
-- 2. A database extension or trigger
-- 3. The Supabase client library during connection setup
--
-- Solution if it persists: Create a materialized view to cache results:
-- CREATE MATERIALIZED VIEW IF NOT EXISTS mv_timezone_names AS
--   SELECT name FROM pg_timezone_names;
-- CREATE UNIQUE INDEX idx_mv_timezone_names ON mv_timezone_names(name);
-- Then replace any pg_timezone_names references with mv_timezone_names.
