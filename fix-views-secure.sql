-- =====================================================
-- FIX: Secure Views with Proper Filtering
-- =====================================================
-- Admin sees ALL users
-- Regular users see ONLY themselves
-- Removes SECURITY DEFINER (not needed)
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS public.user_permissions_view CASCADE;
DROP VIEW IF EXISTS public.user_modules CASCADE;

-- Recreate user_permissions_view with proper security
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
  AND (
    -- ✅ Admin sees everyone
    EXISTS (
      SELECT 1 FROM profiles admin_check
      WHERE admin_check.auth_user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
    -- ✅ Regular user sees only themselves
    OR p.auth_user_id = auth.uid()
  );

-- Recreate user_modules (identical logic)
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
  AND (
    -- ✅ Admin sees everyone
    EXISTS (
      SELECT 1 FROM profiles admin_check
      WHERE admin_check.auth_user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
    -- ✅ Regular user sees only themselves
    OR p.auth_user_id = auth.uid()
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Views recreated with proper security filtering';
  RAISE NOTICE '✅ Admins see all users';
  RAISE NOTICE '✅ Regular users see only themselves';
  RAISE NOTICE '✅ SECURITY DEFINER removed - not needed';
  RAISE NOTICE '';
  RAISE NOTICE 'Test as admin: SELECT COUNT(DISTINCT user_id) FROM user_permissions_view;';
  RAISE NOTICE 'Test as user: SELECT COUNT(DISTINCT user_id) FROM user_permissions_view; -- Should return 1';
END $$;
