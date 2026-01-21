-- =====================================================
-- OFFER SETS + PERMISSION SYSTEM - Migration
-- =====================================================
-- 1. Offer sets - groups of offers for single event
-- 2. Granular permission system for booking features
-- 3. Supervisor role for module management
-- =====================================================

-- =====================================================
-- 1. OFFER SETS (Sety nabídek)
-- =====================================================
-- An offer set groups multiple offers (e.g., 3 stages) for one event

CREATE TABLE offer_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  notes TEXT,

  -- Calculated totals (sum of all offers in set)
  total_equipment DECIMAL(10,2) DEFAULT 0,
  total_personnel DECIMAL(10,2) DEFAULT 0,
  total_transport DECIMAL(10,2) DEFAULT 0,
  total_discount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offer_sets_event ON offer_sets(event_id);
CREATE INDEX idx_offer_sets_status ON offer_sets(status);

-- Add offer_set_id to offers table
ALTER TABLE offers ADD COLUMN offer_set_id UUID REFERENCES offer_sets(id) ON DELETE SET NULL;
ALTER TABLE offers ADD COLUMN set_label TEXT; -- e.g., "Stage A", "Stage B", "FOH"

CREATE INDEX idx_offers_set ON offers(offer_set_id);

-- RLS for offer_sets
ALTER TABLE offer_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offers users can view offer sets" ON offer_sets
  FOR SELECT USING (has_offers_access());

CREATE POLICY "Offers users can create offer sets" ON offer_sets
  FOR INSERT WITH CHECK (has_offers_access());

CREATE POLICY "Offers users can update own sets or admins any" ON offer_sets
  FOR UPDATE USING (
    has_offers_access() AND (
      created_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
    )
  );

CREATE POLICY "Admins can delete offer sets" ON offer_sets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Trigger to update offer_sets totals when offers change
CREATE OR REPLACE FUNCTION update_offer_set_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offer_set_id IS NOT NULL THEN
    UPDATE offer_sets SET
      total_equipment = (SELECT COALESCE(SUM(subtotal_equipment), 0) FROM offers WHERE offer_set_id = NEW.offer_set_id),
      total_personnel = (SELECT COALESCE(SUM(subtotal_personnel), 0) FROM offers WHERE offer_set_id = NEW.offer_set_id),
      total_transport = (SELECT COALESCE(SUM(subtotal_transport), 0) FROM offers WHERE offer_set_id = NEW.offer_set_id),
      total_discount = (SELECT COALESCE(SUM(discount_amount), 0) FROM offers WHERE offer_set_id = NEW.offer_set_id),
      total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM offers WHERE offer_set_id = NEW.offer_set_id),
      updated_at = NOW()
    WHERE id = NEW.offer_set_id;
  END IF;

  -- Also update old set if offer moved to different set
  IF OLD IS NOT NULL AND OLD.offer_set_id IS NOT NULL AND OLD.offer_set_id != NEW.offer_set_id THEN
    UPDATE offer_sets SET
      total_equipment = (SELECT COALESCE(SUM(subtotal_equipment), 0) FROM offers WHERE offer_set_id = OLD.offer_set_id),
      total_personnel = (SELECT COALESCE(SUM(subtotal_personnel), 0) FROM offers WHERE offer_set_id = OLD.offer_set_id),
      total_transport = (SELECT COALESCE(SUM(subtotal_transport), 0) FROM offers WHERE offer_set_id = OLD.offer_set_id),
      total_discount = (SELECT COALESCE(SUM(discount_amount), 0) FROM offers WHERE offer_set_id = OLD.offer_set_id),
      total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM offers WHERE offer_set_id = OLD.offer_set_id),
      updated_at = NOW()
    WHERE id = OLD.offer_set_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_offer_set_totals_trigger
  AFTER INSERT OR UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_offer_set_totals();

-- Update timestamp trigger
CREATE TRIGGER update_offer_sets_updated_at
  BEFORE UPDATE ON offer_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. SUPERVISOR EMAILS (protected superusers)
-- =====================================================
-- Supervisors can manage modules for all users including admins

CREATE TABLE supervisor_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert supervisor emails
INSERT INTO supervisor_emails (email) VALUES
  ('matej.drab16@gmail.com'),
  ('info@drservis.cz');

-- Function to check if current user is supervisor
CREATE OR REPLACE FUNCTION is_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN supervisor_emails se ON LOWER(p.email) = LOWER(se.email)
    WHERE p.auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. GRANULAR PERMISSIONS (Oprávnění pro funkce)
-- =====================================================
-- Permissions define what users can DO within modules

CREATE TABLE permission_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  module_code TEXT REFERENCES app_modules(code) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0
);

-- Insert permission types
INSERT INTO permission_types (code, name, description, module_code, sort_order) VALUES
  -- Booking permissions
  ('booking_view', 'Zobrazit akce', 'Může zobrazit kalendář a akce', 'booking', 1),
  ('booking_invite', 'Zvát na akce', 'Může zvát techniky na akce', 'booking', 2),
  ('booking_manage_events', 'Spravovat akce', 'Může vytvářet a editovat akce', 'booking', 3),
  ('booking_manage_positions', 'Spravovat pozice', 'Může vytvářet a editovat pozice na akcích', 'booking', 4),
  ('booking_manage_users', 'Spravovat uživatele', 'Může vytvářet a editovat uživatele', 'booking', 5),
  ('booking_manage_folders', 'Spravovat složky', 'Může vytvářet Drive složky pro akce', 'booking', 6),
  ('booking_manage_roles', 'Spravovat typy rolí', 'Může vytvářet a editovat typy rolí', 'booking', 7),

  -- Warehouse permissions
  ('warehouse_view', 'Zobrazit sklad', 'Může zobrazit skladové položky', 'warehouse', 1),
  ('warehouse_reserve', 'Rezervovat materiál', 'Může vytvářet rezervace', 'warehouse', 2),
  ('warehouse_manage_items', 'Spravovat položky', 'Může přidávat a editovat skladové položky', 'warehouse', 3),
  ('warehouse_manage_kits', 'Spravovat kity', 'Může vytvářet a editovat kity', 'warehouse', 4),

  -- Offers permissions
  ('offers_view', 'Zobrazit nabídky', 'Může zobrazit nabídky', 'offers', 1),
  ('offers_create', 'Vytvářet nabídky', 'Může vytvářet nové nabídky', 'offers', 2),
  ('offers_edit_own', 'Editovat vlastní', 'Může editovat vlastní nabídky', 'offers', 3),
  ('offers_edit_all', 'Editovat vše', 'Může editovat všechny nabídky', 'offers', 4),
  ('offers_manage_templates', 'Spravovat ceník', 'Může editovat šablony/ceník', 'offers', 5);

-- User permissions table
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permission_types(code) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE(user_id, permission_code)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission_code);

-- RLS for permission tables
ALTER TABLE permission_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permission types" ON permission_types
  FOR SELECT USING (true);

CREATE POLICY "Users can view own permissions" ON user_permissions
  FOR SELECT USING (
    user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admins can manage permissions (but supervisors override for module access)
CREATE POLICY "Admins can manage permissions" ON user_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Function to check if user has specific permission
-- NOTE: Only SUPERVISORS have automatic all permissions.
-- Admins must also have permissions explicitly granted.
CREATE OR REPLACE FUNCTION has_permission(permission_code_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Supervisors have all permissions
  IF is_supervisor() THEN
    RETURN true;
  END IF;

  -- Check specific permission (same for admins and technicians)
  RETURN EXISTS (
    SELECT 1 FROM user_permissions up
    JOIN profiles p ON p.id = up.user_id
    WHERE p.auth_user_id = auth.uid()
    AND up.permission_code = permission_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. UPDATE MODULE ACCESS POLICIES
-- =====================================================
-- Only supervisors can manage module access for admins

DROP POLICY IF EXISTS "Admins can manage module access" ON user_module_access;

CREATE POLICY "Admins can manage module access for non-admins" ON user_module_access
  FOR ALL USING (
    -- Supervisors can manage anyone
    is_supervisor()
    OR
    -- Admins can manage non-admins
    (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
      AND NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = user_module_access.user_id
        AND profiles.role = 'admin'
      )
    )
  );

-- =====================================================
-- 5. GRANT DEFAULT PERMISSIONS TO ADMINS
-- =====================================================
-- Grant all permissions to existing admins
INSERT INTO user_permissions (user_id, permission_code)
SELECT p.id, pt.code
FROM profiles p
CROSS JOIN permission_types pt
WHERE p.role = 'admin'
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- =====================================================
-- 6. VIEW FOR USER PERMISSIONS
-- =====================================================
-- NOTE: Only supervisors have automatic permissions, admins don't
CREATE OR REPLACE VIEW user_permissions_view AS
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
LEFT JOIN user_permissions up ON up.user_id = p.id AND up.permission_code = pt.code;

-- =====================================================
-- 7. UPDATE MODULE ACCESS HELPER FUNCTION
-- =====================================================
-- Update has_module_access to NOT give admins automatic access
CREATE OR REPLACE FUNCTION has_module_access(module_code_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if module is active
  IF NOT EXISTS (SELECT 1 FROM app_modules WHERE code = module_code_param AND is_active = true) THEN
    RETURN false;
  END IF;

  -- Supervisors have access to all modules
  IF is_supervisor() THEN
    RETURN true;
  END IF;

  -- Check user_module_access (same for admins and technicians now)
  RETURN EXISTS (
    SELECT 1 FROM user_module_access uma
    JOIN profiles p ON p.id = uma.user_id
    WHERE p.auth_user_id = auth.uid()
    AND uma.module_code = module_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. UPDATE OFFERS ACCESS FUNCTION
-- =====================================================
-- Update has_offers_access to NOT give admins automatic access
CREATE OR REPLACE FUNCTION has_offers_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_module_access('offers');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
