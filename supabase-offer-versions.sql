-- Offer Versions (Historie verzí nabídky)
-- Run this migration manually in Supabase SQL Editor

CREATE TABLE offer_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  discount_percent DECIMAL(5,2) DEFAULT 0,
  is_vat_payer BOOLEAN DEFAULT true,
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(offer_id, version_number)
);

CREATE INDEX idx_offer_versions_offer ON offer_versions(offer_id);
CREATE INDEX idx_offer_versions_created ON offer_versions(created_at);

-- RLS
ALTER TABLE offer_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offers users can view versions"
  ON offer_versions FOR SELECT
  TO authenticated
  USING (has_offers_access());

CREATE POLICY "Offers users can insert versions"
  ON offer_versions FOR INSERT
  TO authenticated
  WITH CHECK (has_offers_access());

-- Admins can delete versions
CREATE POLICY "Admins can delete versions"
  ON offer_versions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = auth.uid() AND role = 'admin')
  );
