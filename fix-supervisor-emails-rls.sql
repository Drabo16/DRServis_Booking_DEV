-- =====================================================
-- FIX: Enable RLS on supervisor_emails table
-- =====================================================

-- Enable RLS
ALTER TABLE supervisor_emails ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view supervisor emails
CREATE POLICY "Authenticated users can view supervisor emails" ON supervisor_emails
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Only admins can manage supervisor emails
CREATE POLICY "Admins can manage supervisor emails" ON supervisor_emails
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS enabled on supervisor_emails';
  RAISE NOTICE 'Only authenticated users can view';
  RAISE NOTICE 'Only admins can insert/update/delete';
END $$;
