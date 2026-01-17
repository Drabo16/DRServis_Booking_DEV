-- =====================================================
-- Fix RLS policies to use auth_user_id instead of id
-- After decoupling profiles from auth.users
-- =====================================================

-- Drop old policies that use profiles.id = auth.uid()

-- Events policies
DROP POLICY IF EXISTS "Admins can manage events" ON events;

-- Positions policies
DROP POLICY IF EXISTS "Admins can manage positions" ON positions;

-- Assignments policies
DROP POLICY IF EXISTS "Admins can manage assignments" ON assignments;

-- Sync logs policies
DROP POLICY IF EXISTS "Only admins can view sync logs" ON sync_logs;

-- Profiles update policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- =====================================================
-- Recreate policies with auth_user_id
-- =====================================================

-- Users can update their own profile (linked by auth_user_id)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Admins can manage events
CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can manage positions
CREATE POLICY "Admins can manage positions" ON positions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can manage assignments
CREATE POLICY "Admins can manage assignments" ON assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can view sync logs
CREATE POLICY "Only admins can view sync logs" ON sync_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can manage sync logs (insert)
CREATE POLICY "Admins can manage sync logs" ON sync_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
