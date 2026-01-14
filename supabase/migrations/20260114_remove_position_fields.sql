-- =====================================================
-- Remove unused fields from positions table
-- =====================================================

-- Remove description and hourly_rate columns
ALTER TABLE positions DROP COLUMN IF EXISTS description;
ALTER TABLE positions DROP COLUMN IF EXISTS hourly_rate;
