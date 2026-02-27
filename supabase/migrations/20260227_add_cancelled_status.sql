-- Migration: Add 'cancelled' (Storno) to offers status CHECK constraint
-- Find and drop the existing status constraint, then recreate it with 'cancelled' included
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'));
