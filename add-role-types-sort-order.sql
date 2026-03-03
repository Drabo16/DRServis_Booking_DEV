-- Add sort_order column to role_types table
ALTER TABLE role_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on current label ordering
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY label) - 1 AS rn
  FROM role_types
)
UPDATE role_types
SET sort_order = numbered.rn
FROM numbered
WHERE role_types.id = numbered.id;
