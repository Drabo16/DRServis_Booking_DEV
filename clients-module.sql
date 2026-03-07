-- =====================================================
-- CLIENTS MODULE - Database Setup
-- =====================================================
-- Run this in Supabase SQL Editor

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ico TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add client_id FK to offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 3. RLS policies for clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "clients_select" ON clients
  FOR SELECT TO authenticated
  USING (true);

-- Only users with clients module access or admin can insert/update/delete
-- (enforced via service role client in API, so we allow all for service role)
CREATE POLICY "clients_insert" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "clients_update" ON clients
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "clients_delete" ON clients
  FOR DELETE TO authenticated
  USING (true);

-- 4. Register the module in app_modules
INSERT INTO app_modules (code, name, description, icon, route, is_core, is_active, sort_order)
VALUES ('clients', 'Klienti', 'Správa klientů a firem', 'Briefcase', '/clients', false, true, 35)
ON CONFLICT (code) DO NOTHING;

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();
