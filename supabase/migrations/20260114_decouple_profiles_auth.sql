-- =====================================================
-- Decouple profiles from auth.users
-- Allow creating profiles before users authenticate via OAuth
-- =====================================================

-- 1. Drop the foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Make id just a regular UUID (not linked to auth.users)
-- The id is already UUID PRIMARY KEY, we just removed the FK

-- 3. Add optional auth_user_id field to link to auth.users when they login
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Create index for quick lookup by auth_user_id
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);

-- 5. Update existing profiles to set auth_user_id = id (for backwards compatibility)
UPDATE profiles SET auth_user_id = id WHERE auth_user_id IS NULL;

-- Note: Now workflow is:
-- 1. Admin creates profile with email (no auth_user_id yet)
-- 2. User logs in via Google OAuth with that email
-- 3. OAuth callback links auth.users.id to profiles.auth_user_id by matching email
-- 4. User can now access the app
