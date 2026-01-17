-- Performance indexes for DR Servis Booking
-- Optimizes common query patterns

-- Index for events ordered by start_time (most common query)
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time ASC);

-- Index for events filtered by status and start_time
CREATE INDEX IF NOT EXISTS idx_events_status_start_time ON events (status, start_time);

-- Index for positions by event_id (for joining)
CREATE INDEX IF NOT EXISTS idx_positions_event_id ON positions (event_id);

-- Index for assignments by position_id (for joining)
CREATE INDEX IF NOT EXISTS idx_assignments_position_id ON assignments (position_id);

-- Index for assignments by technician_id (for filtering by technician)
CREATE INDEX IF NOT EXISTS idx_assignments_technician_id ON assignments (technician_id);

-- Index for assignments by attendance_status (for filtering)
CREATE INDEX IF NOT EXISTS idx_assignments_attendance_status ON assignments (attendance_status);

-- Composite index for assignments (position + technician)
CREATE INDEX IF NOT EXISTS idx_assignments_position_technician ON assignments (position_id, technician_id);

-- Index for profiles by auth_user_id (for auth lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles (auth_user_id);

-- Index for events with google_event_id (for syncing)
CREATE INDEX IF NOT EXISTS idx_events_google_event_id ON events (google_event_id);

-- Index for events with drive_folder_id (for Drive operations)
CREATE INDEX IF NOT EXISTS idx_events_drive_folder_id ON events (drive_folder_id) WHERE drive_folder_id IS NOT NULL;
