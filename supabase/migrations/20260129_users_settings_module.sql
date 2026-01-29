-- =====================================================
-- USERS & SETTINGS MODULE - Migration
-- =====================================================
-- Adds new module for user and role management
-- Migrates permissions from booking module
-- =====================================================

-- =====================================================
-- 1. ADD NEW MODULE
-- =====================================================
INSERT INTO app_modules (code, name, description, icon, route, is_core, is_active, sort_order)
VALUES ('users_settings', 'Uživatelé a nastavení', 'Správa uživatelů a typů rolí', 'Users', '/users', false, true, 10)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 2. ADD NEW PERMISSIONS
-- =====================================================
INSERT INTO permission_types (code, name, description, module_code, sort_order)
VALUES
  ('users_settings_manage_users', 'Spravovat uživatele', 'Může přidávat a editovat uživatele', 'users_settings', 1),
  ('users_settings_manage_roles', 'Spravovat typy rolí', 'Může přidávat, editovat a mazat typy rolí', 'users_settings', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module_code = EXCLUDED.module_code,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 3. MIGRATE EXISTING PERMISSIONS
-- =====================================================
-- Users who had booking_manage_users get users_settings_manage_users
INSERT INTO user_permissions (user_id, permission_code, granted_at, granted_by)
SELECT user_id, 'users_settings_manage_users', granted_at, granted_by
FROM user_permissions
WHERE permission_code = 'booking_manage_users'
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- Users who had booking_manage_roles get users_settings_manage_roles
INSERT INTO user_permissions (user_id, permission_code, granted_at, granted_by)
SELECT user_id, 'users_settings_manage_roles', granted_at, granted_by
FROM user_permissions
WHERE permission_code = 'booking_manage_roles'
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- =====================================================
-- 4. GRANT MODULE ACCESS TO USERS WITH PERMISSIONS
-- =====================================================
-- Grant users_settings module access to users who have any of the permissions
INSERT INTO user_module_access (user_id, module_code, granted_at, granted_by)
SELECT DISTINCT up.user_id, 'users_settings', NOW(), up.granted_by
FROM user_permissions up
WHERE up.permission_code IN ('users_settings_manage_users', 'users_settings_manage_roles')
ON CONFLICT (user_id, module_code) DO NOTHING;

-- =====================================================
-- 5. GRANT TO ADMINS
-- =====================================================
-- Grant new permissions to all admins
INSERT INTO user_permissions (user_id, permission_code)
SELECT p.id, 'users_settings_manage_users'
FROM profiles p
WHERE p.role = 'admin'
ON CONFLICT (user_id, permission_code) DO NOTHING;

INSERT INTO user_permissions (user_id, permission_code)
SELECT p.id, 'users_settings_manage_roles'
FROM profiles p
WHERE p.role = 'admin'
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- Grant module access to admins
INSERT INTO user_module_access (user_id, module_code)
SELECT p.id, 'users_settings'
FROM profiles p
WHERE p.role = 'admin'
ON CONFLICT (user_id, module_code) DO NOTHING;

-- =====================================================
-- 6. CLEANUP OLD PERMISSIONS (OPTIONAL)
-- =====================================================
-- Remove old booking permissions that are now in users_settings
-- Commented out to preserve backward compatibility - can be enabled later
-- DELETE FROM user_permissions WHERE permission_code IN ('booking_manage_users', 'booking_manage_roles');
-- DELETE FROM permission_types WHERE code IN ('booking_manage_users', 'booking_manage_roles');

-- =====================================================
-- 7. HELPER FUNCTION FOR CHECKING PERMISSION
-- =====================================================
-- Server-side helper to check if user has specific permission
CREATE OR REPLACE FUNCTION check_user_permission(user_auth_id UUID, permission_code_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  profile_id UUID;
  user_email TEXT;
BEGIN
  -- Get profile id and email
  SELECT id, email INTO profile_id, user_email
  FROM profiles
  WHERE auth_user_id = user_auth_id;

  IF profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if supervisor
  IF EXISTS (SELECT 1 FROM supervisor_emails WHERE LOWER(email) = LOWER(user_email)) THEN
    RETURN true;
  END IF;

  -- Check if admin (admins have all permissions)
  IF EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND role = 'admin') THEN
    RETURN true;
  END IF;

  -- Check specific permission
  RETURN EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = profile_id
    AND permission_code = permission_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
