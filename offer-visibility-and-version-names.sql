-- =====================================================
-- MIGRATION: Offer visibility + version names
-- Run this in Supabase SQL editor
-- =====================================================

-- 1. Add visibility column to offers
--    'private' = only creator + admins/supervisors see it (default)
--    'all'     = all users with offers module access can see it
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_visibility_check;

ALTER TABLE offers
  ADD CONSTRAINT offers_visibility_check
  CHECK (visibility IN ('private', 'all'));

-- 2. Add name column to offer_versions (optional label for each snapshot)
ALTER TABLE offer_versions
  ADD COLUMN IF NOT EXISTS name TEXT;
