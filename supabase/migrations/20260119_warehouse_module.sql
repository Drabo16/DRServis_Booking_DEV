-- =====================================================
-- WAREHOUSE MODULE - Skladove hospodarstvi
-- =====================================================
-- This migration creates the warehouse module tables.
-- All tables are prefixed with 'warehouse_' for easy identification and removal.
-- Only foreign key to existing tables: warehouse_reservations.event_id -> events.id

-- =====================================================
-- 1. ADD WAREHOUSE ACCESS TO PROFILES
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_warehouse_access BOOLEAN DEFAULT false;

-- =====================================================
-- 2. WAREHOUSE CATEGORIES
-- =====================================================
CREATE TABLE warehouse_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_categories_sort ON warehouse_categories(sort_order);

-- =====================================================
-- 3. WAREHOUSE ITEMS
-- =====================================================
CREATE TABLE warehouse_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES warehouse_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  is_rent BOOLEAN DEFAULT false,
  unit TEXT DEFAULT 'ks',
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_items_category ON warehouse_items(category_id);
CREATE INDEX idx_warehouse_items_is_rent ON warehouse_items(is_rent);
CREATE INDEX idx_warehouse_items_name ON warehouse_items(name);

-- =====================================================
-- 4. WAREHOUSE KITS (Nadmaterialy/Templates)
-- =====================================================
CREATE TABLE warehouse_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. WAREHOUSE KIT ITEMS (Junction table)
-- =====================================================
CREATE TABLE warehouse_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES warehouse_kits(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(kit_id, item_id)
);

CREATE INDEX idx_warehouse_kit_items_kit ON warehouse_kit_items(kit_id);
CREATE INDEX idx_warehouse_kit_items_item ON warehouse_kit_items(item_id);

-- =====================================================
-- 6. WAREHOUSE RESERVATIONS
-- =====================================================
CREATE TABLE warehouse_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kit_id UUID REFERENCES warehouse_kits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_reservations_event ON warehouse_reservations(event_id);
CREATE INDEX idx_warehouse_reservations_item ON warehouse_reservations(item_id);
CREATE INDEX idx_warehouse_reservations_dates ON warehouse_reservations(start_date, end_date);
CREATE INDEX idx_warehouse_reservations_kit ON warehouse_reservations(kit_id);

-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE warehouse_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_reservations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. HELPER FUNCTION FOR WAREHOUSE ACCESS CHECK
-- =====================================================
CREATE OR REPLACE FUNCTION has_warehouse_access()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.auth_user_id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.has_warehouse_access = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. RLS POLICIES - WAREHOUSE CATEGORIES
-- =====================================================
CREATE POLICY "Warehouse users can view categories" ON warehouse_categories
  FOR SELECT USING (has_warehouse_access());

CREATE POLICY "Admins can insert categories" ON warehouse_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update categories" ON warehouse_categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete categories" ON warehouse_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 10. RLS POLICIES - WAREHOUSE ITEMS
-- =====================================================
CREATE POLICY "Warehouse users can view items" ON warehouse_items
  FOR SELECT USING (has_warehouse_access());

CREATE POLICY "Admins can insert items" ON warehouse_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update items" ON warehouse_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete items" ON warehouse_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 11. RLS POLICIES - WAREHOUSE KITS
-- =====================================================
CREATE POLICY "Warehouse users can view kits" ON warehouse_kits
  FOR SELECT USING (has_warehouse_access());

CREATE POLICY "Admins can insert kits" ON warehouse_kits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update kits" ON warehouse_kits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete kits" ON warehouse_kits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 12. RLS POLICIES - WAREHOUSE KIT ITEMS
-- =====================================================
CREATE POLICY "Warehouse users can view kit items" ON warehouse_kit_items
  FOR SELECT USING (has_warehouse_access());

CREATE POLICY "Admins can insert kit items" ON warehouse_kit_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update kit items" ON warehouse_kit_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete kit items" ON warehouse_kit_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 13. RLS POLICIES - WAREHOUSE RESERVATIONS
-- =====================================================
CREATE POLICY "Warehouse users can view reservations" ON warehouse_reservations
  FOR SELECT USING (has_warehouse_access());

CREATE POLICY "Warehouse users can insert reservations" ON warehouse_reservations
  FOR INSERT WITH CHECK (has_warehouse_access());

CREATE POLICY "Warehouse users can update own reservations" ON warehouse_reservations
  FOR UPDATE USING (
    has_warehouse_access() AND (
      created_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.auth_user_id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

CREATE POLICY "Admins can delete reservations" ON warehouse_reservations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- 14. TRIGGERS FOR updated_at
-- =====================================================
CREATE TRIGGER update_warehouse_categories_updated_at
  BEFORE UPDATE ON warehouse_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_items_updated_at
  BEFORE UPDATE ON warehouse_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_kits_updated_at
  BEFORE UPDATE ON warehouse_kits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_reservations_updated_at
  BEFORE UPDATE ON warehouse_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
