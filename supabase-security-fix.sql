-- =====================================================
-- SUPABASE SECURITY ADVISOR FIX
-- =====================================================
-- Fixes:
-- 1. SECURITY DEFINER views (user_modules, user_permissions_view)
-- 2. Function Search Path Mutable (15 functions)
-- 3. Leaked Password Protection (Auth setting)
--
-- Run in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. FIX SECURITY DEFINER VIEWS
-- =====================================================
-- Recreate views WITHOUT security definer, with proper auth filtering

DROP VIEW IF EXISTS public.user_permissions_view CASCADE;
DROP VIEW IF EXISTS public.user_modules CASCADE;

-- user_permissions_view - shows permissions for current user (admins see all)
CREATE VIEW public.user_permissions_view AS
SELECT
  p.id AS user_id,
  p.auth_user_id,
  p.full_name,
  p.email,
  p.role,
  pt.code AS permission_code,
  pt.name AS permission_name,
  pt.module_code,
  CASE
    WHEN EXISTS (SELECT 1 FROM supervisor_emails se WHERE LOWER(se.email) = LOWER(p.email)) THEN true
    WHEN up.id IS NOT NULL THEN true
    ELSE false
  END AS has_permission
FROM profiles p
CROSS JOIN permission_types pt
LEFT JOIN user_permissions up ON up.user_id = p.id AND up.permission_code = pt.code
WHERE (
  EXISTS (
    SELECT 1 FROM profiles admin_check
    WHERE admin_check.auth_user_id = (SELECT auth.uid())
    AND admin_check.role = 'admin'
  )
  OR p.auth_user_id = (SELECT auth.uid())
);

-- user_modules - shows module access for current user (admins see all)
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
  EXISTS (
    SELECT 1 FROM profiles admin_check
    WHERE admin_check.auth_user_id = (SELECT auth.uid())
    AND admin_check.role = 'admin'
  )
  OR p.auth_user_id = (SELECT auth.uid())
);

-- =====================================================
-- 2. FIX FUNCTION SEARCH PATH MUTABLE
-- =====================================================
-- Set search_path for all functions to prevent search path injection

ALTER FUNCTION public.get_next_offer_number(INTEGER) SET search_path = public;
ALTER FUNCTION public.has_warehouse_access() SET search_path = public;
ALTER FUNCTION public.get_next_offer_set_number(INTEGER) SET search_path = public;
ALTER FUNCTION public.set_offer_set_number() SET search_path = public;
ALTER FUNCTION public.check_user_permission(UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.has_module_access(TEXT) SET search_path = public;
ALTER FUNCTION public.has_offers_access() SET search_path = public;
ALTER FUNCTION public.update_set_totals_on_item_change() SET search_path = public;
ALTER FUNCTION public.has_permission(TEXT) SET search_path = public;
ALTER FUNCTION public.update_offer_set_totals() SET search_path = public;
ALTER FUNCTION public.recalculate_offer_set_totals(UUID) SET search_path = public;
ALTER FUNCTION public.is_supervisor() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_role_types_updated_at() SET search_path = public;

-- =====================================================
-- 3. LEAKED PASSWORD PROTECTION
-- =====================================================
-- This must be enabled in the Supabase Dashboard:
-- Go to: Authentication > Settings > Security
-- Enable: "Leaked password protection"
-- This checks passwords against the HaveIBeenPwned database

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
  fn_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Check functions have search_path set
  SELECT COUNT(*) INTO fn_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_next_offer_number', 'has_warehouse_access', 'get_next_offer_set_number',
    'set_offer_set_number', 'check_user_permission', 'has_module_access',
    'has_offers_access', 'update_set_totals_on_item_change', 'has_permission',
    'update_offer_set_totals', 'recalculate_offer_set_totals', 'is_supervisor',
    'update_updated_at_column', 'update_role_types_updated_at'
  )
  AND p.proconfig IS NOT NULL
  AND 'search_path=public' = ANY(p.proconfig);

  -- Check views exist
  SELECT COUNT(*) INTO view_count
  FROM pg_views WHERE schemaname = 'public'
  AND viewname IN ('user_permissions_view', 'user_modules');

  RAISE NOTICE '=== SECURITY FIX RESULTS ===';
  RAISE NOTICE 'Functions with search_path set: %/14', fn_count;
  RAISE NOTICE 'Views recreated: %/2', view_count;
  RAISE NOTICE '';
  RAISE NOTICE 'MANUAL STEP REQUIRED:';
  RAISE NOTICE 'Enable "Leaked password protection" in Supabase Dashboard > Auth > Settings';
END $$;
