-- =====================================================
-- OFFERS MODULE - Database Migration
-- =====================================================
-- Module for creating and managing price quotes/offers
-- To remove: delete this file and related tables

-- =====================================================
-- 1. TEMPLATE TABLES (Ceník)
-- =====================================================

-- Template categories (e.g., "Ground support", "Zvuková technika")
CREATE TABLE offer_template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template items (price list items)
CREATE TABLE offer_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES offer_template_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subcategory TEXT,
  default_price DECIMAL(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'ks',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offer_template_items_category ON offer_template_items(category_id);

-- =====================================================
-- 2. MAIN OFFERS TABLES
-- =====================================================

-- Offers (main table)
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number INTEGER NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  title TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  notes TEXT,

  -- Calculated totals (stored for performance)
  subtotal_equipment DECIMAL(10,2) DEFAULT 0,
  subtotal_personnel DECIMAL(10,2) DEFAULT 0,
  subtotal_transport DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(year, offer_number)
);

CREATE INDEX idx_offers_year ON offers(year);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_event ON offers(event_id);
CREATE INDEX idx_offers_created_by ON offers(created_by);

-- Offer items (line items in an offer)
CREATE TABLE offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  name TEXT NOT NULL,
  days_hours INTEGER DEFAULT 1,
  quantity INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  template_item_id UUID REFERENCES offer_template_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offer_items_offer ON offer_items(offer_id);
CREATE INDEX idx_offer_items_category ON offer_items(category);

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Get next offer number for the year
CREATE OR REPLACE FUNCTION get_next_offer_number(p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(offer_number), 0) + 1 INTO next_num
  FROM offers
  WHERE year = p_year;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Check if user has offers module access
CREATE OR REPLACE FUNCTION has_offers_access()
RETURNS BOOLEAN AS $$
BEGIN
  -- Admins have access to all modules
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.auth_user_id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check user_module_access for 'offers' module
  RETURN EXISTS (
    SELECT 1 FROM user_module_access uma
    JOIN profiles p ON p.id = uma.user_id
    WHERE p.auth_user_id = auth.uid()
    AND uma.module_code = 'offers'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE offer_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_items ENABLE ROW LEVEL SECURITY;

-- Template categories policies (view all, edit admin only)
CREATE POLICY "Offers users can view template categories" ON offer_template_categories
  FOR SELECT USING (has_offers_access());

CREATE POLICY "Admins can manage template categories" ON offer_template_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Template items policies
CREATE POLICY "Offers users can view template items" ON offer_template_items
  FOR SELECT USING (has_offers_access());

CREATE POLICY "Admins can manage template items" ON offer_template_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Offers policies
CREATE POLICY "Offers users can view offers" ON offers
  FOR SELECT USING (has_offers_access());

CREATE POLICY "Offers users can create offers" ON offers
  FOR INSERT WITH CHECK (has_offers_access());

CREATE POLICY "Offers users can update own offers or admins can update any" ON offers
  FOR UPDATE USING (
    has_offers_access() AND (
      created_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
    )
  );

CREATE POLICY "Admins can delete offers" ON offers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Offer items policies (inherit from parent offer)
CREATE POLICY "Offers users can view offer items" ON offer_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM offers WHERE offers.id = offer_items.offer_id AND has_offers_access())
  );

CREATE POLICY "Offers users can manage offer items" ON offer_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = offer_items.offer_id
      AND has_offers_access()
      AND (
        offers.created_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid() AND profiles.role = 'admin')
      )
    )
  );

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Update timestamps
CREATE TRIGGER update_offer_template_categories_updated_at
  BEFORE UPDATE ON offer_template_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_template_items_updated_at
  BEFORE UPDATE ON offer_template_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. REGISTER MODULE
-- =====================================================

INSERT INTO app_modules (code, name, description, icon, route, is_core, is_active, sort_order)
VALUES (
  'offers',
  'Nabídky',
  'Správa a tvorba cenových nabídek',
  'FileText',
  '/offers',
  false,
  true,
  3
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- 7. SEED DATA - Template Categories and Items
-- =====================================================

-- Insert template categories
INSERT INTO offer_template_categories (name, sort_order) VALUES
  ('Ground support', 1),
  ('Zvuková technika', 2),
  ('Světelná technika', 3),
  ('LED obrazovky + video', 4),
  ('Technický personál', 5),
  ('Doprava', 6);

-- Get category IDs for reference
DO $$
DECLARE
  cat_ground UUID;
  cat_sound UUID;
  cat_light UUID;
  cat_video UUID;
  cat_personnel UUID;
  cat_transport UUID;
BEGIN
  SELECT id INTO cat_ground FROM offer_template_categories WHERE name = 'Ground support';
  SELECT id INTO cat_sound FROM offer_template_categories WHERE name = 'Zvuková technika';
  SELECT id INTO cat_light FROM offer_template_categories WHERE name = 'Světelná technika';
  SELECT id INTO cat_video FROM offer_template_categories WHERE name = 'LED obrazovky + video';
  SELECT id INTO cat_personnel FROM offer_template_categories WHERE name = 'Technický personál';
  SELECT id INTO cat_transport FROM offer_template_categories WHERE name = 'Doprava';

  -- Ground support items
  INSERT INTO offer_template_items (category_id, name, default_price, unit, sort_order) VALUES
    (cat_ground, 'Zastřešení 7x5m 290T tower 5m', 12000, 'den', 1),
    (cat_ground, 'Zastřešení 9x7m 290QD tower 6m', 15000, 'den', 2),
    (cat_ground, 'Zastřešení 10x8m 390QD tower 290 8m', 30000, 'den', 3),
    (cat_ground, 'Zastřešení 10x10m 390QD tower 290 8m', 35000, 'den', 4),
    (cat_ground, 'Zastřešení 12x10m 390QD tower 290 8m', 40000, 'den', 5),
    (cat_ground, 'Zastřešení 11,5x11,5m 520HD tower 390 8m Heavy', 50000, 'den', 6),
    (cat_ground, 'Zastřešení 16x12m 520HD tower 390 11m Heavy', 80000, 'den', 7),
    (cat_ground, 'Back truss (pro světla + backdrop)', 1000, 'den', 8),
    (cat_ground, 'Mid truss pro světla', 1500, 'den', 9),
    (cat_ground, 'Motor 1T chainmaster 24m', 1000, 'den', 10),
    (cat_ground, 'Motor 0,5T exe motors D8 + 24m', 1200, 'den', 11),
    (cat_ground, 'Ovládání motory 6ch + příslušenství', 2000, 'den', 12),
    (cat_ground, 'Podium mobilní 6x8m + schody', 5000, 'den', 13),
    (cat_ground, 'Podium nivtec deska 1x2m + nohy', 350, 'ks', 14),
    (cat_ground, 'Podium nivtec rozměr: 10x8 + schody + zábradlí', 14000, 'den', 15),
    (cat_ground, 'Riser pro bicí 3x2m', 750, 'den', 16),
    (cat_ground, 'Kabelový přejezd 3,5t', 50, 'ks', 17),
    (cat_ground, 'Přípravna 2x4m', 5000, 'den', 18),
    (cat_ground, 'Truss Front 10m', 3000, 'den', 19),
    (cat_ground, 'Truss 3m + patle', 1000, 'ks', 20),
    (cat_ground, 'Nášlapový plot 12m', 200, 'ks', 21),
    (cat_ground, 'VMB TE 74', 500, 'den', 22);

  -- Sound equipment items
  INSERT INTO offer_template_items (category_id, name, subcategory, default_price, unit, sort_order) VALUES
    (cat_sound, 'd&b audiotechnik V8', 'Reproboxy', 1500, 'ks', 1),
    (cat_sound, 'd&b audiotechnik V12', 'Reproboxy', 1500, 'ks', 2),
    (cat_sound, 'd&b audiotechnik V-SUB', 'Reproboxy', 1500, 'ks', 3),
    (cat_sound, 'd&b audiotechnik J-SUB', 'Reproboxy', 2000, 'ks', 4),
    (cat_sound, 'd&b audiotechnik Y10P', 'Reproboxy', 1200, 'ks', 5),
    (cat_sound, 'd&b audiotechnik V7P', 'Reproboxy', 1800, 'ks', 6),
    (cat_sound, 'd&b audiotechnik M4 (monitor)', 'Reproboxy', 800, 'ks', 7),
    (cat_sound, 'd&b audiotechnik E8', 'Reproboxy', 700, 'ks', 8),
    (cat_sound, 'd&b audiotechnik CCL8/12', 'Reproboxy', 1400, 'ks', 9),
    (cat_sound, 'd&b audiotechnik MAX2', 'Reproboxy', 600, 'ks', 10),
    (cat_sound, 'Odposlechový box M6', 'Reproboxy', 500, 'ks', 11),
    (cat_sound, 'QSC PL 4.24', 'Zesilovače', 1000, 'ks', 12),
    (cat_sound, 'd&b audiotechnik D40', 'Zesilovače', 1600, 'ks', 13),
    (cat_sound, 'd&b audiotechnik D80', 'Zesilovače', 2600, 'ks', 14),
    (cat_sound, 'V-Flying frame', 'Příslušenství', 400, 'ks', 15),
    (cat_sound, 'CCL Flying frame', 'Příslušenství', 400, 'ks', 16),
    (cat_sound, 'Kabely k PA NLT8/NLT4 sada 1', 'Příslušenství', 500, 'sada', 17),
    (cat_sound, 'Kabely k PA NLT8/NLT4 sada 2', 'Příslušenství', 1000, 'sada', 18),
    (cat_sound, 'Kabely k PA NLT8/NLT4 sada 3', 'Příslušenství', 1500, 'sada', 19),
    (cat_sound, 'Kabely k PA NLT8/NLT4 sada 4', 'Příslušenství', 2000, 'sada', 20),
    (cat_sound, 'Behringer X32R + SD8', 'Mixážní pulty', 1000, 'den', 21),
    (cat_sound, 'Allen&Heath SQ5 + 2xDX168 stagebox', 'Mixážní pulty', 2000, 'den', 22),
    (cat_sound, 'Allen&Heath SQ6 + 2xDX168T DANTE', 'Mixážní pulty', 3000, 'den', 23),
    (cat_sound, 'Midas Pro 2 + Stagebox 48in 16out', 'Mixážní pulty', 3500, 'den', 24),
    (cat_sound, 'Allen&Heath Dlive C2500 MixRack DM32', 'Mixážní pulty', 4000, 'den', 25),
    (cat_sound, 'Mikrofony + stativy sada festival 1', 'Mikrofony', 500, 'sada', 26),
    (cat_sound, 'Mikrofony + stativy sada festival 2', 'Mikrofony', 1000, 'sada', 27),
    (cat_sound, 'Mikrofony + stativy sada festival 3', 'Mikrofony', 1500, 'sada', 28),
    (cat_sound, 'Mikrofony + stativy Velká sada', 'Mikrofony', 2000, 'sada', 29),
    (cat_sound, 'Bezdrátový mikrofon Shure QLXD', 'Mikrofony', 600, 'ks', 30),
    (cat_sound, 'Bezdrátový mikrofon Sennheiser 2x HAND', 'Mikrofony', 1200, 'ks', 31),
    (cat_sound, 'Bezdrátový mikrofon Sennheiser EW500G4', 'Mikrofony', 600, 'ks', 32),
    (cat_sound, 'Kompletní rozvod 400V/230V sada 1', 'Rozvody', 500, 'sada', 33),
    (cat_sound, 'Kompletní rozvod 400V/230V sada 2', 'Rozvody', 1000, 'sada', 34),
    (cat_sound, 'Kompletní rozvod 400V/230V sada 3', 'Rozvody', 1500, 'sada', 35),
    (cat_sound, 'Kompletní rozvod 400V/230V sada 4', 'Rozvody', 2000, 'sada', 36),
    (cat_sound, 'Kabely XLR + multicore sada 1', 'Rozvody', 500, 'sada', 37),
    (cat_sound, 'Kabely XLR + multicore sada 2', 'Rozvody', 1000, 'sada', 38),
    (cat_sound, 'Kabely XLR + multicore sada 3', 'Rozvody', 1500, 'sada', 39),
    (cat_sound, 'Kabely XLR + multicore sada 4', 'Rozvody', 2000, 'sada', 40);

  -- Light equipment items
  INSERT INTO offer_template_items (category_id, name, subcategory, default_price, unit, sort_order) VALUES
    (cat_light, 'Arri 1000W', 'Statická světla', 500, 'ks', 1),
    (cat_light, 'Arri 2000W', 'Statická světla', 600, 'ks', 2),
    (cat_light, 'Chauvet LED front fresnell 140W', 'Statická světla', 500, 'ks', 3),
    (cat_light, 'Front LED', 'Statická světla', 200, 'ks', 4),
    (cat_light, 'Blinder 4CH pasive', 'Statická světla', 400, 'ks', 5),
    (cat_light, 'Blinder 2CH pasive', 'Statická světla', 200, 'ks', 6),
    (cat_light, 'LED PAR 18x12w IP68', 'Statická světla', 500, 'ks', 7),
    (cat_light, 'LED PAR bateriový bezdrátové DMX IP68', 'Statická světla', 600, 'ks', 8),
    (cat_light, 'Sunstrip', 'Statická světla', 200, 'ks', 9),
    (cat_light, 'Follow spot', 'Statická světla', 1500, 'ks', 10),
    (cat_light, 'Moving head wash PR lighting', 'Otočné hlavy', 600, 'ks', 11),
    (cat_light, 'Moving head wash ROBE 600E', 'Otočné hlavy', 600, 'ks', 12),
    (cat_light, 'Moving head beam/spot pointe', 'Otočné hlavy', 900, 'ks', 13),
    (cat_light, 'Moving head ROBE Spider', 'Otočné hlavy', 1500, 'ks', 14),
    (cat_light, 'Moving head ROBE Pointe', 'Otočné hlavy', 900, 'ks', 15),
    (cat_light, 'Moving head ROBE LED beam 100', 'Otočné hlavy', 500, 'ks', 16),
    (cat_light, 'Dimmer 4ch', 'Ovládání', 500, 'ks', 17),
    (cat_light, 'Dimmer 16ch', 'Ovládání', 1000, 'ks', 18),
    (cat_light, 'Dimmer 64ch', 'Ovládání', 3000, 'ks', 19),
    (cat_light, 'Ovládací PC na světla chamsys', 'Ovládání', 1000, 'den', 20),
    (cat_light, 'Světelný pult chamsys PC wing', 'Ovládání', 2000, 'den', 21),
    (cat_light, 'Světelný pult chamsys MQ80', 'Ovládání', 3000, 'den', 22),
    (cat_light, 'Mega Haze foss (výkonný výrobník mlhy)', 'Efekty', 2000, 'den', 23),
    (cat_light, 'Hazer unique II + náplň', 'Efekty', 1200, 'den', 24),
    (cat_light, 'Rozvody DMX festival + splitt', 'Rozvody', 1000, 'sada', 25),
    (cat_light, 'Rozvody DMX + Artnet + splitt sada 1', 'Rozvody', 1500, 'sada', 26),
    (cat_light, 'Rozvody DMX + Artnet + splitt sada 2', 'Rozvody', 2000, 'sada', 27);

  -- Video/LED items
  INSERT INTO offer_template_items (category_id, name, default_price, unit, sort_order) VALUES
    (cat_video, 'LED OBRAZOVKA P3,9', 2500, 'm2', 1),
    (cat_video, 'LED OBRAZOVKA P6', 1500, 'm2', 2),
    (cat_video, 'LED OBRAZOVKA P2,6', 2800, 'm2', 3),
    (cat_video, 'Rozvody 230V/400V/rozvaděče/sestava/IP65', 1500, 'sada', 4),
    (cat_video, 'Rozvody signál obrazu/4 kamery/střižna/distribuce', 2000, 'sada', 5),
    (cat_video, 'Videorežie Roland V60 HD, PC', 1500, 'den', 6),
    (cat_video, 'Kamera + stativ SONY', 1200, 'ks', 7),
    (cat_video, 'Videorežie Základní sestava (Blackmagic ATEM, 2x kamera)', 10000, 'den', 8),
    (cat_video, 'Videorežie Standardní verze (ATEM PRO, 3x kamera 4K)', 15000, 'den', 9),
    (cat_video, 'Videorežie PRO verze (Blackmagic server, 4x kamera 4K)', 25000, 'den', 10);

  -- Personnel items
  INSERT INTO offer_template_items (category_id, name, default_price, unit, sort_order) VALUES
    (cat_personnel, 'Technická produkce on site', 8000, 'den', 1),
    (cat_personnel, 'Hlavní rigger', 6500, 'den', 2),
    (cat_personnel, 'Stage hands', 270, 'hod', 3),
    (cat_personnel, 'Systémový technik (nastavení PA)', 6000, 'den', 4),
    (cat_personnel, 'Hlavní zvukař', 6500, 'den', 5),
    (cat_personnel, 'Monitorový zvukař', 6000, 'den', 6),
    (cat_personnel, 'Podiový technik', 6000, 'den', 7),
    (cat_personnel, 'Hlavní osvětlovač', 6500, 'den', 8),
    (cat_personnel, 'Technik světla', 5000, 'den', 9),
    (cat_personnel, 'Obsluha LED režie', 6500, 'den', 10),
    (cat_personnel, 'Kameraman', 6000, 'den', 11);

  -- Transport items
  INSERT INTO offer_template_items (category_id, name, default_price, unit, sort_order) VALUES
    (cat_transport, 'Iveco daily 3,5T', 18, 'km', 1),
    (cat_transport, 'Peugeot Boger 3,5T', 17, 'km', 2),
    (cat_transport, 'Iveco 7,5T', 23, 'km', 3),
    (cat_transport, 'Volvo 12T', 30, 'km', 4),
    (cat_transport, 'DAF 30T tandem', 50, 'km', 5),
    (cat_transport, 'Osobní automobil', 7, 'km', 6);

END $$;
