-- =====================================================
-- DIAGNOSTIC CHECK - Run this in Supabase Dashboard
-- =====================================================

-- 1. Check if offer_set_items table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'offer_set_items'
) AS table_exists;

-- 2. Check table structure if it exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'offer_set_items'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'offer_set_items';

-- 4. Check if has_offers_access() function exists
SELECT EXISTS (
  SELECT FROM pg_proc
  WHERE proname = 'has_offers_access'
) AS function_exists;

-- 5. Try a simple insert to see the exact error
DO $$
DECLARE
  test_set_id UUID;
BEGIN
  -- Get a valid offer_set_id
  SELECT id INTO test_set_id FROM offer_sets LIMIT 1;

  IF test_set_id IS NOT NULL THEN
    -- Try to insert
    INSERT INTO offer_set_items (
      offer_set_id,
      name,
      category,
      unit_price,
      quantity,
      days_hours
    ) VALUES (
      test_set_id,
      'TEST ITEM - DELETE ME',
      'TEST',
      100,
      1,
      1
    );

    -- Clean up if successful
    DELETE FROM offer_set_items WHERE name = 'TEST ITEM - DELETE ME';
    RAISE NOTICE '✅ Insert test PASSED - table is working correctly';
  ELSE
    RAISE NOTICE '⚠️  No offer_sets found to test with';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Insert test FAILED: %', SQLERRM;
END $$;
