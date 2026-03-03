-- =====================================================
-- EVENT SECTIONS (Stages) - e.g. Stage A, Stage B, FOH
-- =====================================================
-- Run this in Supabase SQL Editor

-- 1) Create event_sections table
CREATE TABLE IF NOT EXISTS event_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Add section_id to positions (nullable - positions without section belong to "general")
ALTER TABLE positions ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES event_sections(id) ON DELETE SET NULL;

-- 3) RLS policies for event_sections
ALTER TABLE event_sections ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read event sections
CREATE POLICY "event_sections_select" ON event_sections
  FOR SELECT TO authenticated USING (true);

-- Allow admins and supervisors to manage sections
CREATE POLICY "event_sections_insert" ON event_sections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND (
        p.role = 'admin'
        OR EXISTS (SELECT 1 FROM supervisor_emails se WHERE se.email ILIKE p.email)
        OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = p.id AND up.permission_code = 'booking_manage_positions')
      )
    )
  );

CREATE POLICY "event_sections_update" ON event_sections
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND (
        p.role = 'admin'
        OR EXISTS (SELECT 1 FROM supervisor_emails se WHERE se.email ILIKE p.email)
        OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = p.id AND up.permission_code = 'booking_manage_positions')
      )
    )
  );

CREATE POLICY "event_sections_delete" ON event_sections
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.auth_user_id = auth.uid()
      AND (
        p.role = 'admin'
        OR EXISTS (SELECT 1 FROM supervisor_emails se WHERE se.email ILIKE p.email)
        OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = p.id AND up.permission_code = 'booking_manage_positions')
      )
    )
  );

-- 4) Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_sections_event_id ON event_sections(event_id);
CREATE INDEX IF NOT EXISTS idx_positions_section_id ON positions(section_id);
