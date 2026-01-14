-- =====================================================
-- DR SERVIS BOOKING - INITIAL SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES (rozšíření vestavěné Supabase Auth)
-- =====================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
  specialization TEXT[], -- např. ['sound', 'lights', 'stage']
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EVENTS (akce ze Google Kalendáře)
-- =====================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT UNIQUE NOT NULL, -- ID z Google Calendar API
  google_calendar_id TEXT NOT NULL, -- ID kalendáře, ze kterého pochází
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  drive_folder_url TEXT, -- odkaz na složku na Google Drive
  drive_folder_id TEXT, -- ID složky pro API operace
  html_link TEXT, -- odkaz na událost v Google Calendar
  created_by UUID REFERENCES profiles(id),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pro rychlé vyhledávání podle data
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_google_id ON events(google_event_id);

-- =====================================================
-- POSITIONS (pozice/role na akci)
-- =====================================================
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- např. "Hlavní zvukař", "Osvětlovač 1"
  role_type TEXT NOT NULL, -- např. 'sound', 'lights', 'stage', 'video'
  description TEXT,
  requirements TEXT[], -- např. ['driving_license', 'forklift_cert']
  shift_start TIMESTAMPTZ, -- může být jiný než začátek akce
  shift_end TIMESTAMPTZ,
  hourly_rate DECIMAL(10,2), -- hodinová sazba pro tuto pozici
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_event ON positions(event_id);

-- =====================================================
-- ASSIGNMENTS (přiřazení lidí na pozice)
-- =====================================================
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Status z Google Calendar attendee
  attendance_status TEXT DEFAULT 'pending' CHECK (attendance_status IN ('pending', 'accepted', 'declined', 'tentative')),
  response_time TIMESTAMPTZ, -- kdy člověk odpověděl

  -- Interní poznámky
  notes TEXT,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Pro sledování změn
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(position_id, technician_id) -- jedna osoba na pozici max 1x
);

CREATE INDEX idx_assignments_event ON assignments(event_id);
CREATE INDEX idx_assignments_technician ON assignments(technician_id);
CREATE INDEX idx_assignments_status ON assignments(attendance_status);

-- =====================================================
-- SYNC_LOG (pro sledování synchronizací)
-- =====================================================
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('calendar_ingest', 'status_check', 'attendee_update')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  events_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RLS (Row Level Security) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: každý vidí všechny profily (pro výběr techniků)
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Events: všichni authenticated uživatelé vidí všechny akce
CREATE POLICY "Events are viewable by authenticated users" ON events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin může vše s events
CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Positions: viditelné pro všechny authenticated
CREATE POLICY "Positions are viewable by authenticated users" ON positions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage positions" ON positions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Assignments: viditelné pro všechny authenticated
CREATE POLICY "Assignments are viewable by authenticated users" ON assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage assignments" ON assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Sync logs: pouze admin
CREATE POLICY "Only admins can view sync logs" ON sync_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Funkce pro automatickou aktualizaci updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggery pro updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA (optional - pro testování)
-- =====================================================
-- Po vytvoření prvního uživatele přes Supabase Auth,
-- manuálně přidej jeho ID do profiles s role='admin'
