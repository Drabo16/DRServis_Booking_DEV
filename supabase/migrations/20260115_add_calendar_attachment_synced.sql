-- Add calendar_attachment_synced field to events table
-- This field tracks whether the Drive folder has been attached as an attachment to the Google Calendar event

ALTER TABLE events
ADD COLUMN IF NOT EXISTS calendar_attachment_synced boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN events.calendar_attachment_synced IS 'Tracks whether the Drive folder attachment has been synced to Google Calendar';
