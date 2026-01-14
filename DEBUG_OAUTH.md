# Debug OAuth Přihlášení

## Problém
Přihlášení přes Google OAuth zobrazuje "Přístup odepřen" i když je účet vytvořený.

## Kontrolní seznam

### 1. Zkontrolujte, že migrace byly spuštěny

Otevřete Supabase Dashboard → SQL Editor a spusťte tento query pro kontrolu:

```sql
-- Zkontrolujte, že sloupec auth_user_id existuje
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'auth_user_id';
```

**Očekávaný výsledek:**
```
column_name   | data_type
--------------+-----------
auth_user_id  | uuid
```

❌ Pokud sloupec **neexistuje** → migrace nebyla spuštěna, spusťte ji z [MIGRACE_INSTRUKCE.md](MIGRACE_INSTRUKCE.md)

✅ Pokud sloupec **existuje** → migrace proběhla OK, pokračujte

---

### 2. Ověřte, že uživatel byl vytvořen správně

Spusťte v SQL Editoru:

```sql
-- Najděte uživatele podle emailu
SELECT id, email, full_name, is_active, auth_user_id, role
FROM profiles
WHERE email = 'VÁŠE_EMAIL@gmail.com';  -- Změňte na váš email
```

**Očekávaný výsledek:**
- `is_active` = `true`
- `auth_user_id` = `null` (zatím se nepřihlásil)
- `role` = `admin` nebo `technician`

❌ Pokud uživatel **neexistuje** → vytvořte ho znovu přes aplikaci jako admin

❌ Pokud `is_active` = `false` → aktivujte účet:
```sql
UPDATE profiles SET is_active = true WHERE email = 'VÁŠE_EMAIL@gmail.com';
```

---

### 3. Otestujte přihlášení s debug loggingem

1. Otevřete aplikaci v prohlížeči
2. Otevřete Developer Console (F12)
3. Přejděte na záložku "Console"
4. Klikněte na "Přihlásit se přes Google"
5. Dokončete přihlášení přes Google
6. Sledujte console logy

**Co hledat v console:**

```
[OAuth Callback] User authenticated: vase.email@gmail.com
[OAuth Callback] Profile not found for email: vase.email@gmail.com
```

Pokud vidíte "Profile not found":
- Email v Google účtu se **neshoduje** s emailem v databázi
- Zkontrolujte přesný tvar emailu (case-sensitive)

---

### 4. Zkontrolujte shodu emailů

Spusťte v SQL Editoru:

```sql
-- Vypište všechny emaily v profiles
SELECT email FROM profiles ORDER BY email;
```

Porovnejte s emailem vašeho Google účtu. Musí být **přesná shoda** (včetně velikosti písmen).

---

### 5. Manuální linkování (nouzové řešení)

Pokud nic nefunguje, můžete manuálně propojit účty:

1. Přihlaste se přes Google (i když to skončí chybou)
2. Najděte auth.users ID v SQL Editoru:

```sql
-- Najděte auth.users záznam
SELECT id, email
FROM auth.users
WHERE email = 'VÁŠE_EMAIL@gmail.com';
```

3. Zkopírujte UUID z sloupce `id`

4. Propojte s profiles:

```sql
-- Propojte accounts (použijte UUID z předchozího query)
UPDATE profiles
SET auth_user_id = 'ZKOPÍROVANÉ_UUID_ZDE'
WHERE email = 'VÁŠE_EMAIL@gmail.com';
```

5. Zkuste se přihlásit znovu

---

## Časté chyby

### "column auth_user_id does not exist"
→ Migrace nebyla spuštěna. Spusťte migraci 1 z [MIGRACE_INSTRUKCE.md](MIGRACE_INSTRUKCE.md)

### "Přístup odepřen" i když je vše správně
→ Zkontrolujte, že:
1. Email v profiles a auth.users je **naprosto identický**
2. `is_active = true` v profiles
3. Middleware používá `auth_user_id` (ne `id`) - to už je opravené v kódu

### "new row violates row-level security policy"
→ RLS policy nebyla přidána. Spusťte migraci 2 z [MIGRACE_INSTRUKCE.md](MIGRACE_INSTRUKCE.md)

---

## Úspěšné přihlášení - co očekávat

Po úspěšném přihlášení:

1. Console ukáže:
```
[OAuth Callback] User authenticated: vase.email@gmail.com
[OAuth Callback] Linking auth_user_id to profile
[OAuth Callback] Profile found, redirecting to dashboard
```

2. V databázi bude `auth_user_id` vyplněno:
```sql
SELECT email, auth_user_id FROM profiles WHERE email = 'VÁŠE_EMAIL@gmail.com';
-- auth_user_id bude obsahovat UUID (ne null)
```

3. Přesměrování na dashboard (/)
