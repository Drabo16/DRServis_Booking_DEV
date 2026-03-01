-- =====================================================
-- MIGRATION: Per-user offer sharing + version names
-- Run this in Supabase SQL editor
-- =====================================================

-- 1. Table for per-user offer sharing
--    Admins can share specific offers with specific users.
--    Shared users can see the offer even if they didn't create it.
CREATE TABLE IF NOT EXISTS offer_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id, user_id)
);

ALTER TABLE offer_shares ENABLE ROW LEVEL SECURITY;

-- Admins and supervisors can manage all shares
CREATE POLICY "Admins can manage offer shares" ON offer_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM supervisor_emails se
      JOIN profiles p ON p.email ILIKE se.email
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- Users can view shares that apply to them (so they know what's shared)
CREATE POLICY "Users can view their own shares" ON offer_shares
  FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  );

-- 2. Add name column to offer_versions (optional label for each snapshot)
ALTER TABLE offer_versions
  ADD COLUMN IF NOT EXISTS name TEXT;
