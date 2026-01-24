-- =====================================================
-- FIX: Ambiguous column reference in offer_set trigger
-- =====================================================
-- Error: "column reference total_equipment is ambiguous"
-- Cause: Trigger subqueries don't use table aliases
-- Fix: Add explicit table aliases to all subqueries

CREATE OR REPLACE FUNCTION update_offer_set_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offer_set_id IS NOT NULL THEN
    UPDATE offer_sets SET
      total_equipment = (SELECT COALESCE(SUM(o.subtotal_equipment), 0) FROM offers o WHERE o.offer_set_id = NEW.offer_set_id),
      total_personnel = (SELECT COALESCE(SUM(o.subtotal_personnel), 0) FROM offers o WHERE o.offer_set_id = NEW.offer_set_id),
      total_transport = (SELECT COALESCE(SUM(o.subtotal_transport), 0) FROM offers o WHERE o.offer_set_id = NEW.offer_set_id),
      total_discount = (SELECT COALESCE(SUM(o.discount_amount), 0) FROM offers o WHERE o.offer_set_id = NEW.offer_set_id),
      total_amount = (SELECT COALESCE(SUM(o.total_amount), 0) FROM offers o WHERE o.offer_set_id = NEW.offer_set_id),
      updated_at = NOW()
    WHERE id = NEW.offer_set_id;
  END IF;

  -- Also update old set if offer moved to different set
  IF OLD IS NOT NULL AND OLD.offer_set_id IS NOT NULL AND OLD.offer_set_id != NEW.offer_set_id THEN
    UPDATE offer_sets SET
      total_equipment = (SELECT COALESCE(SUM(o.subtotal_equipment), 0) FROM offers o WHERE o.offer_set_id = OLD.offer_set_id),
      total_personnel = (SELECT COALESCE(SUM(o.subtotal_personnel), 0) FROM offers o WHERE o.offer_set_id = OLD.offer_set_id),
      total_transport = (SELECT COALESCE(SUM(o.subtotal_transport), 0) FROM offers o WHERE o.offer_set_id = OLD.offer_set_id),
      total_discount = (SELECT COALESCE(SUM(o.discount_amount), 0) FROM offers o WHERE o.offer_set_id = OLD.offer_set_id),
      total_amount = (SELECT COALESCE(SUM(o.total_amount), 0) FROM offers o WHERE o.offer_set_id = OLD.offer_set_id),
      updated_at = NOW()
    WHERE id = OLD.offer_set_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
