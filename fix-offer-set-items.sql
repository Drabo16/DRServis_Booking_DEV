-- =====================================================
-- FIX OFFER SET ITEMS - Safe migration for existing table
-- =====================================================
-- This migration safely updates existing offer_set_items table
-- Drops and recreates policies to avoid conflicts

-- Add discount to offer_sets if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offer_sets' AND column_name = 'discount_percent'
  ) THEN
    ALTER TABLE offer_sets ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;
  END IF;
END $$;

-- Add offer number columns if not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offer_sets' AND column_name = 'offer_number'
  ) THEN
    ALTER TABLE offer_sets ADD COLUMN offer_number INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offer_sets' AND column_name = 'year'
  ) THEN
    ALTER TABLE offer_sets ADD COLUMN year INTEGER DEFAULT EXTRACT(YEAR FROM NOW());
  END IF;
END $$;

-- Create sequence
CREATE SEQUENCE IF NOT EXISTS offer_set_number_seq START 1;

-- Function to get next offer set number
CREATE OR REPLACE FUNCTION get_next_offer_set_number(year_param INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(offer_number), 0) + 1 INTO next_num
  FROM offer_sets
  WHERE year = year_param;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger function
CREATE OR REPLACE FUNCTION set_offer_set_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offer_number IS NULL THEN
    NEW.year := EXTRACT(YEAR FROM NOW());
    NEW.offer_number := get_next_offer_set_number(NEW.year);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS set_offer_set_number_trigger ON offer_sets;
CREATE TRIGGER set_offer_set_number_trigger
  BEFORE INSERT ON offer_sets
  FOR EACH ROW EXECUTE FUNCTION set_offer_set_number();

-- Create offer_set_items table if not exists
CREATE TABLE IF NOT EXISTS offer_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_set_id UUID NOT NULL REFERENCES offer_sets(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES offer_template_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT DEFAULT 'ks',
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  days_hours INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10,2) GENERATED ALWAYS AS (unit_price * quantity * days_hours) STORED,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offer_set_items_set ON offer_set_items(offer_set_id);
CREATE INDEX IF NOT EXISTS idx_offer_set_items_category ON offer_set_items(category);

-- Enable RLS
ALTER TABLE offer_set_items ENABLE ROW LEVEL SECURITY;

-- DROP existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Offers users can view set items" ON offer_set_items;
DROP POLICY IF EXISTS "Offers users can manage set items" ON offer_set_items;

-- Recreate policies
CREATE POLICY "Offers users can view set items" ON offer_set_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM offer_sets os
      WHERE os.id = offer_set_items.offer_set_id
      AND has_offers_access()
    )
  );

CREATE POLICY "Offers users can manage set items" ON offer_set_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM offer_sets os
      WHERE os.id = offer_set_items.offer_set_id
      AND has_offers_access()
    )
  );

-- Recalculate totals function
CREATE OR REPLACE FUNCTION recalculate_offer_set_totals(set_id UUID)
RETURNS VOID AS $$
DECLARE
  offers_equipment DECIMAL(10,2);
  offers_personnel DECIMAL(10,2);
  offers_transport DECIMAL(10,2);
  offers_discount DECIMAL(10,2);
  items_equipment DECIMAL(10,2);
  items_personnel DECIMAL(10,2);
  items_transport DECIMAL(10,2);
  set_discount_percent DECIMAL(5,2);
  total_equipment DECIMAL(10,2);
  final_discount DECIMAL(10,2);
  final_total DECIMAL(10,2);
BEGIN
  -- Get totals from sub-offers
  SELECT
    COALESCE(SUM(subtotal_equipment), 0),
    COALESCE(SUM(subtotal_personnel), 0),
    COALESCE(SUM(subtotal_transport), 0),
    COALESCE(SUM(discount_amount), 0)
  INTO offers_equipment, offers_personnel, offers_transport, offers_discount
  FROM offers WHERE offer_set_id = set_id;

  -- Get totals from direct items
  SELECT
    COALESCE(SUM(CASE WHEN category IN ('Ground support', 'Zvuková technika', 'Světelná technika', 'LED obrazovky + video') THEN total_price ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Technický personál' THEN total_price ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Doprava' THEN total_price ELSE 0 END), 0)
  INTO items_equipment, items_personnel, items_transport
  FROM offer_set_items WHERE offer_set_id = set_id;

  -- Get set discount percent
  SELECT COALESCE(discount_percent, 0) INTO set_discount_percent
  FROM offer_sets WHERE id = set_id;

  -- Calculate totals
  total_equipment := offers_equipment + items_equipment;
  final_discount := offers_discount + ROUND(total_equipment * set_discount_percent / 100, 2);
  final_total := total_equipment + (offers_personnel + items_personnel) + (offers_transport + items_transport) - final_discount;

  -- Update offer_set
  UPDATE offer_sets SET
    total_equipment = total_equipment,
    total_personnel = offers_personnel + items_personnel,
    total_transport = offers_transport + items_transport,
    total_discount = final_discount,
    total_amount = final_total,
    updated_at = NOW()
  WHERE id = set_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger for offer_set_items changes
CREATE OR REPLACE FUNCTION update_set_totals_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_offer_set_totals(OLD.offer_set_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_offer_set_totals(NEW.offer_set_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_set_totals_on_item_change_trigger ON offer_set_items;
CREATE TRIGGER update_set_totals_on_item_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON offer_set_items
  FOR EACH ROW EXECUTE FUNCTION update_set_totals_on_item_change();

-- Update offer_set_totals trigger (already fixed with aliases in previous migration)
CREATE OR REPLACE FUNCTION update_offer_set_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offer_set_id IS NOT NULL THEN
    PERFORM recalculate_offer_set_totals(NEW.offer_set_id);
  END IF;

  IF OLD IS NOT NULL AND OLD.offer_set_id IS NOT NULL AND (NEW.offer_set_id IS NULL OR OLD.offer_set_id != NEW.offer_set_id) THEN
    PERFORM recalculate_offer_set_totals(OLD.offer_set_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE 'Table offer_set_items is ready';
  RAISE NOTICE 'RLS policies updated';
  RAISE NOTICE 'Triggers configured';
END $$;
