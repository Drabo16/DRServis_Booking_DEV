-- =====================================================
-- Fix: Assign existing offers without created_by to supervisor
-- =====================================================
-- Run this in Supabase SQL Editor ONCE after deployment.
-- All offers that have NULL created_by will be assigned to
-- the first supervisor found in supervisor_emails table.
-- This ensures non-supervisor users don't see orphaned offers.

UPDATE offers
SET created_by = (
  SELECT p.id
  FROM profiles p
  JOIN supervisor_emails se ON LOWER(p.email) = LOWER(se.email)
  LIMIT 1
)
WHERE created_by IS NULL;

-- Verify offers result
SELECT
  COUNT(*) FILTER (WHERE created_by IS NULL) AS still_null,
  COUNT(*) FILTER (WHERE created_by IS NOT NULL) AS assigned
FROM offers;

-- =====================================================
-- Fix: Assign existing offer_sets (projects) without created_by
-- =====================================================
UPDATE offer_sets
SET created_by = (
  SELECT p.id
  FROM profiles p
  JOIN supervisor_emails se ON LOWER(p.email) = LOWER(se.email)
  LIMIT 1
)
WHERE created_by IS NULL;

-- Verify offer_sets result
SELECT
  COUNT(*) FILTER (WHERE created_by IS NULL) AS sets_still_null,
  COUNT(*) FILTER (WHERE created_by IS NOT NULL) AS sets_assigned
FROM offer_sets;
