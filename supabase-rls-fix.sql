-- =============================================================================
-- Supabase RLS Performance Fix: Wrap auth.uid() and auth.role() in (SELECT ...)
-- =============================================================================
--
-- This script addresses the #1 performance recommendation from Supabase
-- Performance Advisor: wrapping auth.uid() and auth.role() calls in
-- (SELECT auth.uid()) and (SELECT auth.role()) to prevent per-row auth
-- context initialization in RLS policies and functions.
--
-- Without the (SELECT ...) wrapper, PostgreSQL re-evaluates auth.uid() for
-- every single row checked by RLS, which causes redundant calls to the auth
-- context initialization function. Wrapping in (SELECT ...) ensures the value
-- is computed once and cached for the duration of the query.
--
-- This script:
--   1. Rewrites 5 functions that directly call auth.uid()
--   2. Recreates 2 wrapper functions for completeness
--   3. Drops and recreates all RLS policies that directly reference
--      auth.uid() or auth.role() in their USING/WITH CHECK clauses
--
-- Policies that only call helper functions (has_warehouse_access(),
-- has_offers_access(), etc.) without direct auth calls are NOT recreated,
-- since fixing the underlying function is sufficient.
--
-- Generated: 2026-02-14
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: REWRITE FUNCTIONS
-- =============================================================================

-- 1. is_supervisor()
CREATE OR REPLACE FUNCTION is_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN supervisor_emails se ON LOWER(p.email) = LOWER(se.email)
    WHERE p.auth_user_id = (SELECT auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. has_module_access(module_code_param TEXT)
CREATE OR REPLACE FUNCTION has_module_access(module_code_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_modules WHERE code = module_code_param AND is_active = true) THEN
    RETURN false;
  END IF;

  IF is_supervisor() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_module_access uma
    JOIN profiles p ON p.id = uma.user_id
    WHERE p.auth_user_id = (SELECT auth.uid())
    AND uma.module_code = module_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. has_warehouse_access() - wrapper, recreated for completeness
CREATE OR REPLACE FUNCTION has_warehouse_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_module_access('warehouse');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. has_offers_access() - wrapper, recreated for completeness
CREATE OR REPLACE FUNCTION has_offers_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_module_access('offers');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. has_permission(permission_code_param TEXT)
CREATE OR REPLACE FUNCTION has_permission(permission_code_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF is_supervisor() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_permissions up
    JOIN profiles p ON p.id = up.user_id
    WHERE p.auth_user_id = (SELECT auth.uid())
    AND up.permission_code = permission_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. check_user_permission(user_auth_id UUID, permission_code_param TEXT)
--    SKIPPED: This function takes user_auth_id as a parameter and does not
--    call auth.uid() directly. No fix needed.


-- =============================================================================
-- PART 2: DROP AND RECREATE RLS POLICIES WITH (SELECT ...) WRAPPERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: profiles (5 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: events (2 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Events are viewable by authenticated users" ON events;
CREATE POLICY "Events are viewable by authenticated users"
  ON events FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage events" ON events;
CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: positions (2 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Positions are viewable by authenticated users" ON positions;
CREATE POLICY "Positions are viewable by authenticated users"
  ON positions FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage positions" ON positions;
CREATE POLICY "Admins can manage positions"
  ON positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: assignments (2 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Assignments are viewable by authenticated users" ON assignments;
CREATE POLICY "Assignments are viewable by authenticated users"
  ON assignments FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage assignments" ON assignments;
CREATE POLICY "Admins can manage assignments"
  ON assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: sync_logs (2 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Only admins can view sync logs" ON sync_logs;
CREATE POLICY "Only admins can view sync logs"
  ON sync_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage sync logs" ON sync_logs;
CREATE POLICY "Admins can manage sync logs"
  ON sync_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: app_modules (1 policy with auth call)
-- "Anyone can view active modules" uses (is_active = true) - no auth, skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can manage modules" ON app_modules;
CREATE POLICY "Admins can manage modules"
  ON app_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: user_module_access (2 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own module access" ON user_module_access;
CREATE POLICY "Users can view own module access"
  ON user_module_access FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Note: This policy was renamed from "Admins can manage module access" in migration 20260121
DROP POLICY IF EXISTS "Admins can manage module access" ON user_module_access;
DROP POLICY IF EXISTS "Admins can manage module access for non-admins" ON user_module_access;
CREATE POLICY "Admins can manage module access for non-admins"
  ON user_module_access FOR ALL
  USING (
    is_supervisor()
    OR (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.auth_user_id = (SELECT auth.uid())
        AND profiles.role = 'admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = user_module_access.user_id
        AND profiles.role = 'admin'
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Table: warehouse_categories (3 policies with direct auth calls)
-- "Warehouse users can view categories" only calls has_warehouse_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert categories" ON warehouse_categories;
CREATE POLICY "Admins can insert categories"
  ON warehouse_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update categories" ON warehouse_categories;
CREATE POLICY "Admins can update categories"
  ON warehouse_categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete categories" ON warehouse_categories;
CREATE POLICY "Admins can delete categories"
  ON warehouse_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: warehouse_items (3 policies with direct auth calls)
-- "Warehouse users can view items" only calls has_warehouse_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert items" ON warehouse_items;
CREATE POLICY "Admins can insert items"
  ON warehouse_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update items" ON warehouse_items;
CREATE POLICY "Admins can update items"
  ON warehouse_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete items" ON warehouse_items;
CREATE POLICY "Admins can delete items"
  ON warehouse_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: warehouse_kits (3 policies with direct auth calls)
-- "Warehouse users can view kits" only calls has_warehouse_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert kits" ON warehouse_kits;
CREATE POLICY "Admins can insert kits"
  ON warehouse_kits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update kits" ON warehouse_kits;
CREATE POLICY "Admins can update kits"
  ON warehouse_kits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete kits" ON warehouse_kits;
CREATE POLICY "Admins can delete kits"
  ON warehouse_kits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: warehouse_kit_items (3 policies with direct auth calls)
-- "Warehouse users can view kit items" only calls has_warehouse_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can insert kit items" ON warehouse_kit_items;
CREATE POLICY "Admins can insert kit items"
  ON warehouse_kit_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update kit items" ON warehouse_kit_items;
CREATE POLICY "Admins can update kit items"
  ON warehouse_kit_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete kit items" ON warehouse_kit_items;
CREATE POLICY "Admins can delete kit items"
  ON warehouse_kit_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: warehouse_reservations (2 policies with direct auth calls)
-- "Warehouse users can view reservations" only calls has_warehouse_access() - skipped
-- "Warehouse users can insert reservations" only calls has_warehouse_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Warehouse users can update own reservations" ON warehouse_reservations;
CREATE POLICY "Warehouse users can update own reservations"
  ON warehouse_reservations FOR UPDATE
  USING (
    has_warehouse_access() AND (
      created_by = (SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.auth_user_id = (SELECT auth.uid())
        AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete reservations" ON warehouse_reservations;
CREATE POLICY "Admins can delete reservations"
  ON warehouse_reservations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: offer_template_categories (1 policy with direct auth call)
-- "Offers users can view template categories" only calls has_offers_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can manage template categories" ON offer_template_categories;
CREATE POLICY "Admins can manage template categories"
  ON offer_template_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: offer_template_items (1 policy with direct auth call)
-- "Offers users can view template items" only calls has_offers_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can manage template items" ON offer_template_items;
CREATE POLICY "Admins can manage template items"
  ON offer_template_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: offers (2 policies with direct auth calls)
-- "Offers users can view offers" only calls has_offers_access() - skipped
-- "Offers users can create offers" only calls has_offers_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Offers users can update own offers or admins can update any" ON offers;
CREATE POLICY "Offers users can update own offers or admins can update any"
  ON offers FOR UPDATE
  USING (
    has_offers_access() AND (
      created_by = (SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.auth_user_id = (SELECT auth.uid())
        AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete offers" ON offers;
CREATE POLICY "Admins can delete offers"
  ON offers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: offer_items (1 policy with direct auth calls)
-- "Offers users can view offer items" only calls has_offers_access() in subquery - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Offers users can manage offer items" ON offer_items;
CREATE POLICY "Offers users can manage offer items"
  ON offer_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_items.offer_id
      AND has_offers_access()
      AND (
        offers.created_by = (SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid()))
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.auth_user_id = (SELECT auth.uid())
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Table: offer_sets (2 policies with direct auth calls)
-- "Offers users can view offer sets" only calls has_offers_access() - skipped
-- "Offers users can create offer sets" only calls has_offers_access() - skipped
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Offers users can update own sets or admins any" ON offer_sets;
CREATE POLICY "Offers users can update own sets or admins any"
  ON offer_sets FOR UPDATE
  USING (
    has_offers_access() AND (
      created_by = (SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.auth_user_id = (SELECT auth.uid())
        AND profiles.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete offer sets" ON offer_sets;
CREATE POLICY "Admins can delete offer sets"
  ON offer_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: offer_set_items
-- Both policies only call has_offers_access() in subqueries - no direct auth calls
-- SKIPPED
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Table: user_permissions (2 policies)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage permissions" ON user_permissions;
CREATE POLICY "Admins can manage permissions"
  ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Table: permission_types
-- "Anyone can view permission types" uses USING (true) - no auth call
-- SKIPPED
-- -----------------------------------------------------------------------------

COMMIT;

-- =============================================================================
-- DIAGNOSTIC: Verify the fix was applied
-- =============================================================================
-- Run this query after applying the script to confirm no policies still have
-- bare auth.uid() or auth.role() calls (without the SELECT wrapper):
--
--   SELECT schemaname, tablename, policyname, qual, with_check
--   FROM pg_policies
--   WHERE (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.role()%'
--          OR with_check LIKE '%auth.uid()%' OR with_check LIKE '%auth.role()%')
--     AND schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- After applying this fix, the above query should return zero rows, since all
-- auth calls are now wrapped in (SELECT ...) subqueries.
-- =============================================================================
