-- Offer Presets (Vzorové nabídky)
-- Run this migration manually in Supabase SQL Editor

-- Preset header
CREATE TABLE offer_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  is_vat_payer BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preset items
CREATE TABLE offer_preset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES offer_presets(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES offer_template_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT DEFAULT 'ks',
  unit_price DECIMAL(10,2) DEFAULT 0,
  days_hours INTEGER DEFAULT 1,
  quantity INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_offer_preset_items_preset ON offer_preset_items(preset_id);

-- RLS policies
ALTER TABLE offer_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_preset_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read presets
CREATE POLICY "Authenticated users can read presets"
  ON offer_presets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read preset items"
  ON offer_preset_items FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify presets
-- NOTE: profiles.auth_user_id maps to auth.uid() (NOT profiles.id)
CREATE POLICY "Admins can insert presets"
  ON offer_presets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update presets"
  ON offer_presets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete presets"
  ON offer_presets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert preset items"
  ON offer_preset_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update preset items"
  ON offer_preset_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete preset items"
  ON offer_preset_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );
