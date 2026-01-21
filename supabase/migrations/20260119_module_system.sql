-- =====================================================
-- MODULE SYSTEM - Modulovy system s pristupovymi pravy
-- =====================================================
-- This migration creates a flexible module access system.
-- Modules can be easily added/removed without touching core tables.
--
-- To remove this system: DROP TABLE user_module_access, app_modules CASCADE;
-- =====================================================

-- =====================================================
-- 1. APP MODULES - Available modules in the system
-- =====================================================
CREATE TABLE app_modules (
  code TEXT PRIMARY KEY,                    -- 'booking', 'warehouse', 'offers', etc.
  name TEXT NOT NULL,                       -- Display name: 'Booking', 'Sklad', 'Nabídky'
  description TEXT,                         -- Module description
  icon TEXT,                                -- Lucide icon name: 'Calendar', 'Package', etc.
  route TEXT NOT NULL,                      -- Base route: '/', '/warehouse', '/offers'
  is_core BOOLEAN DEFAULT false,            -- Core modules cannot be disabled (booking)
  is_active BOOLEAN DEFAULT true,           -- Can disable modules globally
  sort_order INTEGER DEFAULT 0,             -- Display order in sidebar
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default modules
INSERT INTO app_modules (code, name, description, icon, route, is_core, is_active, sort_order) VALUES
  ('booking', 'Booking', 'Správa akcí a přiřazování techniků', 'Calendar', '/', true, true, 1),
  ('warehouse', 'Sklad', 'Skladové hospodářství a rezervace materiálu', 'Package', '/warehouse', false, true, 2);

-- =====================================================
-- 2. USER MODULE ACCESS - Which users have access to which modules
-- =====================================================
CREATE TABLE user_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_code TEXT NOT NULL REFERENCES app_modules(code) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE(user_id, module_code)
);

CREATE INDEX idx_user_module_access_user ON user_module_access(user_id);
CREATE INDEX idx_user_module_access_module ON user_module_access(module_code);

-- =====================================================
-- 3. MIGRATE EXISTING WAREHOUSE ACCESS
-- =====================================================
-- Migrate users with has_warehouse_access=true to new system
INSERT INTO user_module_access (user_id, module_code, granted_at)
SELECT id, 'warehouse', NOW()
FROM profiles
WHERE has_warehouse_access = true
ON CONFLICT (user_id, module_code) DO NOTHING;

-- Grant all admins access to all modules
INSERT INTO user_module_access (user_id, module_code, granted_at)
SELECT p.id, m.code, NOW()
FROM profiles p
CROSS JOIN app_modules m
WHERE p.role = 'admin'
ON CONFLICT (user_id, module_code) DO NOTHING;

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE app_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_module_access ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES - APP MODULES
-- =====================================================
-- Everyone can view active modules
CREATE POLICY "Anyone can view active modules" ON app_modules
  FOR SELECT USING (is_active = true);

-- Only admins can manage modules
CREATE POLICY "Admins can manage modules" ON app_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 6. RLS POLICIES - USER MODULE ACCESS
-- =====================================================
-- Users can view their own module access
CREATE POLICY "Users can view own module access" ON user_module_access
  FOR SELECT USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can grant/revoke module access
CREATE POLICY "Admins can manage module access" ON user_module_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 7. HELPER FUNCTION - Check module access
-- =====================================================
CREATE OR REPLACE FUNCTION has_module_access(module_code_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if module is active
  IF NOT EXISTS (SELECT 1 FROM app_modules WHERE code = module_code_param AND is_active = true) THEN
    RETURN false;
  END IF;

  -- Admins have access to all modules
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.auth_user_id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check user_module_access
  RETURN EXISTS (
    SELECT 1 FROM user_module_access uma
    JOIN profiles p ON p.id = uma.user_id
    WHERE p.auth_user_id = auth.uid()
    AND uma.module_code = module_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. UPDATE WAREHOUSE ACCESS FUNCTION
-- =====================================================
-- Update has_warehouse_access() to use new module system
CREATE OR REPLACE FUNCTION has_warehouse_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_module_access('warehouse');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. VIEWS FOR EASY QUERYING
-- =====================================================
-- View: User's accessible modules
CREATE OR REPLACE VIEW user_modules AS
SELECT
  p.id AS user_id,
  p.auth_user_id,
  p.full_name,
  p.role,
  m.code AS module_code,
  m.name AS module_name,
  m.icon,
  m.route,
  m.is_core,
  m.sort_order,
  CASE
    WHEN p.role = 'admin' THEN true
    WHEN uma.id IS NOT NULL THEN true
    ELSE false
  END AS has_access
FROM profiles p
CROSS JOIN app_modules m
LEFT JOIN user_module_access uma ON uma.user_id = p.id AND uma.module_code = m.code
WHERE m.is_active = true;

-- =====================================================
-- CLEANUP NOTE
-- =====================================================
-- The has_warehouse_access column on profiles is now redundant
-- but kept for backward compatibility. It can be removed in future:
-- ALTER TABLE profiles DROP COLUMN has_warehouse_access;
