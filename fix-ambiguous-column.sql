-- =====================================================
-- FIX: Ambiguous column reference in recalculate_offer_set_totals
-- =====================================================

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
  calc_total_equipment DECIMAL(10,2);  -- ✅ Renamed to avoid conflict
  calc_final_discount DECIMAL(10,2);   -- ✅ Renamed to avoid conflict
  calc_final_total DECIMAL(10,2);      -- ✅ Renamed to avoid conflict
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
  calc_total_equipment := offers_equipment + items_equipment;
  calc_final_discount := offers_discount + ROUND(calc_total_equipment * set_discount_percent / 100, 2);
  calc_final_total := calc_total_equipment + (offers_personnel + items_personnel) + (offers_transport + items_transport) - calc_final_discount;

  -- Update offer_set (now using calc_ prefixed variables)
  UPDATE offer_sets SET
    total_equipment = calc_total_equipment,
    total_personnel = offers_personnel + items_personnel,
    total_transport = offers_transport + items_transport,
    total_discount = calc_final_discount,
    total_amount = calc_final_total,
    updated_at = NOW()
  WHERE id = set_id;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Function recalculate_offer_set_totals fixed!';
  RAISE NOTICE 'Renamed variables to avoid ambiguous column references';
END $$;
