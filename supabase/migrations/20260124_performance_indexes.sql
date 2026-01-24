-- =====================================================
-- PERFORMANCE OPTIMIZATION - Add indexes
-- =====================================================
-- Add indexes to speed up common queries

-- Offers table indexes
CREATE INDEX IF NOT EXISTS idx_offers_created_at ON offers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_offer_set_id ON offers(offer_set_id) WHERE offer_set_id IS NOT NULL;

-- Offer items table indexes
CREATE INDEX IF NOT EXISTS idx_offer_items_offer_id_created_at ON offer_items(offer_id, created_at);

-- User module access indexes
CREATE INDEX IF NOT EXISTS idx_user_module_access_user_module ON user_module_access(user_id, module_code);

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;
