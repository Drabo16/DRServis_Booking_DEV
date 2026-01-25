-- =====================================================
-- Add VAT payer field to offers and offer_sets
-- =====================================================

-- Add is_vat_payer to offers table
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS is_vat_payer BOOLEAN DEFAULT true;

-- Add is_vat_payer to offer_sets table
ALTER TABLE offer_sets
ADD COLUMN IF NOT EXISTS is_vat_payer BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN offers.is_vat_payer IS 'True if customer is VAT payer (shows price with VAT)';
COMMENT ON COLUMN offer_sets.is_vat_payer IS 'True if customer is VAT payer (shows price with VAT)';
