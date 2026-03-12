-- =====================================================
-- Prevent duplicate offer items per template
-- =====================================================
-- Root cause: no unique constraint allowed two rows with
-- the same (offer_id, template_item_id), e.g. from concurrent
-- saves in two tabs or a save-in-flight + autosave race.
--
-- PostgreSQL treats NULL != NULL for UNIQUE purposes, so custom
-- items (template_item_id IS NULL) are unaffected — multiple
-- custom items per offer are still allowed.

-- Step 1: Remove any existing duplicates, keeping the row with
-- the highest value (days_hours * quantity * unit_price), then
-- by most recent created_at as tiebreaker.
DELETE FROM offer_items
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY offer_id, template_item_id
             ORDER BY days_hours * quantity * unit_price DESC, created_at DESC
           ) AS rn
    FROM offer_items
    WHERE template_item_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add the unique constraint.
ALTER TABLE offer_items
  ADD CONSTRAINT offer_items_unique_template_per_offer
  UNIQUE (offer_id, template_item_id);
