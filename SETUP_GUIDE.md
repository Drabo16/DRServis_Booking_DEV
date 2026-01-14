# 🚀 Setup Guide pro DR Servis Booking

Rychlý průvodce pro spuštění aplikace od nuly.

## ✅ Checklist

- [ ] Node.js 18+ nainstalováno
- [ ] Git nainstalován
- [ ] Supabase účet vytvořen
- [ ] Google Cloud projekt vytvořen
- [ ] Service Account nastaven

---

## 1️⃣ Instalace Projektu

```bash
# Nainstalujte závislosti
npm install
```

---

## 2️⃣ Supabase Setup

### A) Vytvořte projekt

1. Jděte na [supabase.com](https://supabase.com)
2. Klikněte na "New Project"
3. Zadejte název: `drservis-booking`
4. Vyberte region (nejlépe Frankfurt)
5. Vytvořte silné heslo pro databázi

### B) Spusťte SQL migraci

1. V Supabase Dashboard otevřete **SQL Editor**
2. Klikněte na **New Query**
3. Zkopírujte celý obsah souboru `supabase/migrations/20260113_initial_schema.sql`
4. Vložte do editoru a klikněte **Run**
5. Měli byste vidět zprávu "Success. No rows returned"

### C) Získejte API klíče

1. V Supabase Dashboard jděte do **Project Settings** → **API**
2. Poznamenejte si:
   - `Project URL` (např. `https://abcdefgh.supabase.co`)
   - `anon public` klíč
   - `service_role` klíč (⚠️ tajný!)

---

## 3️⃣ Google Cloud Setup

### A) Vytvořte projekt

1. Jděte na [console.cloud.google.com](https://console.cloud.google.com)
2. Klikněte na **Select a project** → **New Project**
3. Název: `drservis-booking`
4. Klikněte **Create**

### B) Aktivujte API

1. V Google Cloud Console jděte na **APIs & Services** → **Library**
2. Vyhledejte a aktivujte:
   - **Google Calendar API**
   - **Google Drive API**

### C) Vytvořte Service Account

1. Jděte na **IAM & Admin** → **Service Accounts**
2. Klikněte **Create Service Account**
3. Vyplňte:
   - Name: `drservis-booking-sa`
   - Description: "Service account for DR Servis Booking app"
4. Klikněte **Create and Continue**
5. Role: můžete přeskočit (není nutné pro naši aplikaci)
6. Klikněte **Done**

### D) Stáhněte JSON klíč

1. Najděte vytvořený Service Account
2. Klikněte na email Service Account
3. Jděte na **Keys** tab
4. Klikněte **Add Key** → **Create new key**
5. Vyberte **JSON** formát
6. Klikněte **Create** → Stáhne se JSON soubor

### E) Sdílejte kalendář s Service Account

1. Otevřete **Google Calendar** ([calendar.google.com](https://calendar.google.com))
2. Najděte firemní kalendář, ze kterého chcete načítat akce
3. Klikněte na **⚙️ Settings and sharing**
4. Scrollujte dolů na **Share with specific people**
5. Klikněte **Add people**
6. Vložte **email Service Account** (z JSON souboru, klíč `client_email`)
7. Nastavte oprávnění: **Make changes to events**
8. Klikněte **Send**

### F) Získejte Calendar ID

1. V Google Calendar najděte kalendář
2. Klikněte na **⚙️ Settings and sharing**
3. Scrollujte dolů na **Integrate calendar**
4. Zkopírujte **Calendar ID** (např. `abc123@group.calendar.google.com`)

### G) Nastavte Google Drive

1. Otevřete **Google Drive** ([drive.google.com](https://drive.google.com))
2. Vytvořte složku pro akce (např. "DR Servis - Akce")
3. Klikněte pravým na složku → **Share**
4. Přidejte **email Service Account**
5. Nastavte oprávnění: **Editor**
6. Klikněte **Share**
7. Získejte **Folder ID** z URL (např. `drive.google.com/drive/folders/1A2B3C4D...` → `1A2B3C4D...`)

---

## 4️⃣ Environment Variables

Otevřete soubor `.env.local` a vyplňte:

```bash
# Supabase (z kroku 2C)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google Service Account (ze staženého JSON)
GOOGLE_SERVICE_ACCOUNT_EMAIL=drservis-booking-sa@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# Google Calendar & Drive (z kroku 3F a 3G)
GOOGLE_CALENDAR_ID=abc123@group.calendar.google.com
GOOGLE_DRIVE_PARENT_FOLDER_ID=1A2B3C4D...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-random-secret-string-123
```

### ⚠️ DŮLEŽITÉ pro GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:

Private key musí být v uvozovkách a obsahovat `\n` pro nové řádky:

```bash
# ✅ SPRÁVNĚ:
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n"

# ❌ ŠPATNĚ:
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIB...
-----END PRIVATE KEY-----
```

---

## 5️⃣ Vytvoření prvního admina

### Možnost A: Přes Supabase Auth UI

1. Spusťte aplikaci: `npm run dev`
2. Otevřete [http://localhost:3000/login](http://localhost:3000/login)
3. Zaregistrujte se přes Supabase (nebo vytvořte uživatele přímo v Supabase Dashboard)

### Možnost B: Přímo v Supabase

1. Jděte do Supabase Dashboard → **Authentication** → **Users**
2. Klikněte **Add user**
3. Zadejte email a heslo
4. Klikněte **Create user**
5. Zkopírujte **User ID** (UUID)

### Přidání do profiles tabulky

1. Jděte do **Table Editor** → **profiles**
2. Klikněte **Insert row**
3. Vyplňte:
   - `id`: UUID uživatele z Auth
   - `email`: email uživatele
   - `full_name`: "Admin" (nebo vaše jméno)
   - `role`: `admin` (důležité!)
4. Klikněte **Save**

---

## 6️⃣ Spuštění Aplikace

```bash
npm run dev
```

Aplikace běží na: [http://localhost:3000](http://localhost:3000)

---

## 7️⃣ První Použití

1. **Přihlaste se** s admin účtem
2. **Klikněte na "Synchronizovat"** v hlavičce
3. Aplikace načte akce z Google Calendar
4. **Otevřete detail akce**
5. **Přidejte pozice** (např. Zvukař, Osvětlovač)
6. **Přiřaďte techniky** na pozice
7. **Odešlete pozvánky** pomocí ikony obálky

---

## 🐛 Řešení problémů

### "Failed to fetch calendar events"

**Příčina:** Service Account nemá přístup ke kalendáři

**Řešení:**
1. Ověřte, že jste sdíleli kalendář s emailem Service Account
2. Zkontrolujte, že oprávnění jsou "Make changes to events"
3. Počkejte 1-2 minuty (může trvat, než se oprávnění projeví)

---

### "Failed to create folder on Drive"

**Příčina:** Service Account nemá přístup k Drive složce

**Řešení:**
1. Ověřte, že jste sdíleli rodičovskou složku s emailem Service Account
2. Zkontrolujte, že oprávnění jsou "Editor"
3. Ověřte správnost `GOOGLE_DRIVE_PARENT_FOLDER_ID`

---

### "Invalid private key"

**Příčina:** Špatně formátovaný private key v `.env.local`

**Řešení:**
1. Private key musí být v uvozovkách
2. Musí obsahovat `\n` pro nové řádky (ne skutečné řádky)
3. Použijte tento Python script pro konverzi:

```python
import json

with open('your-service-account-key.json') as f:
    data = json.load(f)
    print(data['private_key'])
```

Výstup zkopírujte do `.env.local` včetně uvozovek.

---

### Pozvánky se neposílají

**Možné příčiny a řešení:**

1. **Technik nemá email v profilu**
   - Přidejte email v Supabase Table Editor → profiles

2. **Status zůstává "pending"**
   - Po odeslání pozvánky klikněte "Obnovit statusy"
   - Technik musí odpovědět v Google Calendar (přijmout/odmítnout)

3. **Google API kvóty**
   - Zkontrolujte v Google Cloud Console → APIs & Services → Dashboard
   - Calendar API má limit 1,000,000 requests/den (mělo by stačit)

---

## 📚 Další kroky

- Přidejte další techniky do systému
- Nastavte pravidelnou synchronizaci (např. přes cron job)
- Customizujte vzhled aplikace podle firemního brandu
- Přidejte další funkce podle potřeby

---

## 💡 Tipy

- Používejte **"Synchronizovat"** pravidelně pro aktuální data
- **"Obnovit statusy"** v detailu akce zobrazí aktuální odpovědi techniků
- Složky na Drive se vytvoří automaticky při prvním kliknutí na tlačítko

---

## 🆘 Potřebujete pomoc?

Pokud narazíte na problém, který není popsán výše:

1. Zkontrolujte konzoli prohlížeče (F12 → Console)
2. Zkontrolujte server logs (terminál kde běží `npm run dev`)
3. Ověřte všechny environment variables
4. Zkontrolujte oprávnění v Google Cloud Console

---

Hotovo! Aplikace je připravena k použití. 🎉
