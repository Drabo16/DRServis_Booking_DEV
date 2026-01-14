# Instrukce pro spuštění migrací

## Krok 1: Přejděte do Supabase Dashboard

1. Otevřete prohlížeč a jděte na: https://supabase.com/dashboard
2. Přihlaste se
3. Vyberte váš projekt (DR Servis Booking)

## Krok 2: Otevřete SQL Editor

1. V levém menu klikněte na **"SQL Editor"**
2. Klikněte na **"New query"** (nebo použijte existující prázdný editor)

## Krok 3: Spusťte migrace v tomto pořadí

### Migrace 1: Decouple profiles from auth.users

Zkopírujte a vložte tento SQL kód, pak klikněte **"Run"** nebo stiskněte **Ctrl+Enter**:

```sql
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
```

✅ Počkejte na "Success" zprávu

---

### Migrace 2: Fix RLS policies for profiles

Zkopírujte a spusťte tento SQL:

```sql
-- =====================================================
-- Fix RLS policy for profiles table
-- Allow admins to insert new profiles
-- =====================================================

-- Add INSERT policy for admins to create new profiles
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add UPDATE policy for admins to update any profile
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add DELETE policy for admins to delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.auth_user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

✅ Počkejte na "Success" zprávu

---

### Migrace 3: Remove unused position fields

Zkopírujte a spusťte tento SQL:

```sql
-- =====================================================
-- Remove unused fields from positions table
-- =====================================================

-- Remove description and hourly_rate columns
ALTER TABLE positions DROP COLUMN IF EXISTS description;
ALTER TABLE positions DROP COLUMN IF EXISTS hourly_rate;
```

✅ Počkejte na "Success" zprávu

---

## Krok 4: Ověření

Po spuštění všech 3 migrací:

1. **Otestujte vytvoření uživatele** (jako admin v aplikaci)
2. **Otestujte přihlášení** přes Google OAuth s emailem, který jste právě vytvořili
3. **Otestujte přiřazování techniků** k pozicím

---

## Řešení problémů

### Pokud dostanete chybu "column already exists"
- To je OK, migrace používá `IF NOT EXISTS`, takže se nic nestane
- Pokračujte další migrací

### Pokud dostanete chybu "policy already exists"
- To je OK, politika už existuje
- Pokračujte další migrací

### Pokud dostanete jinou chybu
- Zkopírujte celou chybovou zprávu
- Sdílejte mi ji pro diagnostiku
