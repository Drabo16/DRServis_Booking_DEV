-- =====================================================
-- Add manager role to profiles
-- =====================================================
-- Adds 'manager' to the allowed roles in profiles table

-- Drop the old CHECK constraint and add new one with 'manager'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'manager', 'technician'));

-- Comment for documentation
COMMENT ON COLUMN profiles.role IS 'User role: admin (full access), manager (booking + configurable), technician (basic access)';
