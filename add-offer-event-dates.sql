-- Add event date fields to offers table
-- These allow specifying the event date range directly on the offer
-- (can be auto-filled from linked event or set manually)

ALTER TABLE offers ADD COLUMN IF NOT EXISTS event_start_date DATE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS event_end_date DATE;
