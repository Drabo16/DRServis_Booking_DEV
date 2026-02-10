-- Extend profiles table with new fields for user import
-- is_drservis: Whether user is a member of DRServis company
-- company: External company name (for non-DRServis members)
-- note: Quick note about the user

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_drservis BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add start_date and end_date to assignments for partial day assignments
-- This allows assigning technicians to only part of a multi-day event
-- If NULL, the assignment covers the entire event duration

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add check constraint to ensure end_date >= start_date when both are set
ALTER TABLE assignments
ADD CONSTRAINT assignments_date_range_check
CHECK (
  (start_date IS NULL AND end_date IS NULL) OR
  (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
);

-- Create index for efficient date-based queries on assignments
CREATE INDEX IF NOT EXISTS idx_assignments_date_range
ON assignments(start_date, end_date)
WHERE start_date IS NOT NULL;

-- Update existing profiles to set is_drservis based on email domain (optional migration)
-- Users with @drservis.cz email are likely DRServis members
UPDATE profiles
SET is_drservis = CASE
  WHEN email ILIKE '%@drservis%' THEN true
  ELSE true -- Default to true for existing users
END
WHERE is_drservis IS NULL;

COMMENT ON COLUMN profiles.is_drservis IS 'Whether user is a member of DRServis company';
COMMENT ON COLUMN profiles.company IS 'External company name (for non-DRServis members)';
COMMENT ON COLUMN profiles.note IS 'Quick note about the user';
COMMENT ON COLUMN assignments.start_date IS 'Start date for partial day assignment (NULL = entire event)';
COMMENT ON COLUMN assignments.end_date IS 'End date for partial day assignment (NULL = entire event)';
