-- Create role_types table for dynamic role management
CREATE TABLE IF NOT EXISTS role_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE role_types ENABLE ROW LEVEL SECURITY;

-- Polícy pro čtení - všichni mohou číst
CREATE POLICY "Everyone can view role types"
  ON role_types
  FOR SELECT
  USING (true);

-- Policy pro insert/update/delete - pouze admin
CREATE POLICY "Only admins can modify role types"
  ON role_types
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Vložení výchozích hodnot (z constants.ts)
INSERT INTO role_types (value, label) VALUES
  ('sound', 'Zvukař'),
  ('lights', 'Osvětlovač'),
  ('stage', 'Stage'),
  ('video', 'Kameraman'),
  ('other', 'Ostatní')
ON CONFLICT (value) DO NOTHING;

-- Trigger pro automatickou aktualizaci updated_at
CREATE OR REPLACE FUNCTION update_role_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_types_updated_at
  BEFORE UPDATE ON role_types
  FOR EACH ROW
  EXECUTE FUNCTION update_role_types_updated_at();
