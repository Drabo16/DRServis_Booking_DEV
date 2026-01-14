# Rychlý test OAuth přihlášení

## Krok 1: Smažte problémového uživatele

1. Přihlaste se jako admin
2. Jděte na "Uživatelé"
3. Najděte uživatele, kterého jste vytvořili
4. Klikněte "Upravit"
5. Scroll dolů a klikněte **"Smazat uživatele"**
6. Potvrďte smazání

---

## Krok 2: Vytvořte uživatele znovu

1. Klikněte "Přidat uživatele"
2. **DŮLEŽITÉ:** Použijte PŘESNĚ stejný email jako váš Google účet
   - Zkontrolujte, že email má správné velké/malé písmena
   - Např. pokud je váš Google: `Test@Gmail.com`, napište přesně: `Test@Gmail.com`
3. Vyplňte celé jméno
4. Vyberte roli (např. admin)
5. Klikněte "Vytvořit uživatele"

---

## Krok 3: Ověřte v databázi

Otevřete Supabase Dashboard → SQL Editor a spusťte:

```sql
-- Zkontrolujte, že uživatel byl vytvořen
SELECT id, email, full_name, is_active, auth_user_id, role
FROM profiles
WHERE email = 'VÁŠ_EMAIL@gmail.com';  -- Nahraďte svým emailem
```

**Ověřte:**
- ✅ `is_active` = `true`
- ✅ `auth_user_id` = `null` (zatím se nepřihlásil)
- ✅ Email je PŘESNĚ stejný jako váš Google účet

---

## Krok 4: Odhlaste se a zkuste se přihlásit

1. Odhlaste se z aplikace (v hlavičce)
2. Na login stránce klikněte **"Přihlásit se přes Google"**
3. Vyberte Google účet s emailem, který jste použili v kroku 2
4. Otevřete Developer Console (F12) → Console záložka
5. Sledujte logy

**Co byste měli vidět v console:**
```
[OAuth Callback] User authenticated: vas.email@gmail.com
[OAuth Callback] Linking auth_user_id to profile
[OAuth Callback] Profile found, redirecting to dashboard
```

**Pokud vidíte:**
```
[OAuth Callback] Profile not found for email: vas.email@gmail.com
```
→ Email se neshoduje! Zkontrolujte přesný email v Google účtu vs databázi

---

## Krok 5: Ověřte propojení v databázi

Po úspěšném přihlášení spusťte:

```sql
-- Ověřte, že auth_user_id byl nastaven
SELECT id, email, auth_user_id
FROM profiles
WHERE email = 'VÁŠ_EMAIL@gmail.com';
```

**Očekáváno:**
- `auth_user_id` už NENÍ null, ale obsahuje UUID

---

## Řešení problémů

### "Přístup odepřen" i po vytvoření nového uživatele

1. Zkontrolujte email v Google účtu:
   - Jděte na https://myaccount.google.com/
   - Zkopírujte přesný email

2. Zkontrolujte email v databázi:
   ```sql
   SELECT email FROM profiles;
   ```

3. Porovnejte - MUSÍ být identické (včetně velikosti písmen)

### Email se shoduje, ale stále nejde

Zkuste manuální propojení:

```sql
-- 1. Najděte auth.users ID
SELECT id, email FROM auth.users WHERE email = 'VÁŠ_EMAIL@gmail.com';

-- 2. Zkopírujte UUID z předchozího query

-- 3. Propojte s profiles
UPDATE profiles
SET auth_user_id = 'ZKOPÍROVANÉ_UUID_ZDE'
WHERE email = 'VÁŠ_EMAIL@gmail.com';
```

Poté zkuste přihlášení znovu.

---

## Po úspěšném přihlášení

Měli byste vidět:
1. Dashboard aplikace
2. Vaše jméno v hlavičce
3. Přístup ke všem stránkám (akce, uživatelé atd.)

Hotovo! 🎉
