-- =====================================================
-- FIX: Security Definer Views - user_permissions_view & user_modules
-- =====================================================
-- These views currently expose ALL users' data to anyone
-- We'll recreate them to only show current user's data
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS public.user_permissions_view;
DROP VIEW IF EXISTS public.user_modules;

-- Recreate user_permissions_view WITHOUT security definer
-- This view will show ONLY the current authenticated user's permissions
CREATE VIEW public.user_permissions_view AS
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
WHERE m.is_active = true
  AND p.auth_user_id = auth.uid();  -- ✅ SECURITY FIX: Only current user's data

-- Recreate user_modules (appears to be identical to user_permissions_view)
CREATE VIEW public.user_modules AS
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
WHERE m.is_active = true
  AND p.auth_user_id = auth.uid();  -- ✅ SECURITY FIX: Only current user's data

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Views recreated WITHOUT security definer';
  RAISE NOTICE '✅ Views now filter by auth.uid() - users see only their own data';
  RAISE NOTICE 'Test: SELECT * FROM user_permissions_view;';
END $$;
