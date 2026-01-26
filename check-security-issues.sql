-- =====================================================
-- CHECK SECURITY ISSUES - Run in Supabase Dashboard
-- =====================================================

-- 1. Check user_permissions_view definition
SELECT pg_get_viewdef('public.user_permissions_view', true) AS view_definition;

-- 2. Check user_modules view definition
SELECT pg_get_viewdef('public.user_modules', true) AS view_definition;

-- 3. Check supervisor_emails table structure and data
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'supervisor_emails'
ORDER BY ordinal_position;

-- 4. Check if supervisor_emails has any data
SELECT COUNT(*) as row_count FROM supervisor_emails;

-- 5. Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('supervisor_emails', 'user_module_access', 'profiles')
ORDER BY tablename;

-- 6. Check existing RLS policies on supervisor_emails
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'supervisor_emails';
