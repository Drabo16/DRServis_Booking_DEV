-- Fix RLS policies for offer_presets and offer_preset_items
-- The original migration used profiles.id = auth.uid() which is WRONG
-- Correct mapping: profiles.auth_user_id = auth.uid()
--
-- Run this in Supabase SQL Editor if you already ran supabase-offer-presets.sql

-- Drop incorrect policies
DROP POLICY IF EXISTS "Admins can insert presets" ON offer_presets;
DROP POLICY IF EXISTS "Admins can update presets" ON offer_presets;
DROP POLICY IF EXISTS "Admins can delete presets" ON offer_presets;
DROP POLICY IF EXISTS "Admins can insert preset items" ON offer_preset_items;
DROP POLICY IF EXISTS "Admins can update preset items" ON offer_preset_items;
DROP POLICY IF EXISTS "Admins can delete preset items" ON offer_preset_items;

-- Recreate with correct auth_user_id check
CREATE POLICY "Admins can insert presets"
  ON offer_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update presets"
  ON offer_presets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete presets"
  ON offer_presets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert preset items"
  ON offer_preset_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update preset items"
  ON offer_preset_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete preset items"
  ON offer_preset_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );
