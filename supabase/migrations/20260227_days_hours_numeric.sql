-- Migration: Change days_hours from INTEGER to NUMERIC(10,2)
-- Reason: Support decimal values like 0.5, 1.5, 2.5 days/hours
ALTER TABLE offer_items ALTER COLUMN days_hours TYPE NUMERIC(10,2);
ALTER TABLE offer_items ALTER COLUMN days_hours SET DEFAULT 1;
