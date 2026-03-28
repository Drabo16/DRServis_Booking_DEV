# Plán migrace Google služeb – DRServis Booking

## Přehled

Migrace z osobního Google účtu na Google Workspace klienta (DR Servis s.r.o.).
Migrují se pouze Google služby (Calendar, Drive). Supabase a Vercel zůstávají beze změny.

---

## 1. Co se migruje

| Služba | Současný stav | Cílový stav |
|--------|--------------|-------------|
| **Google Calendar** | Sdílený kalendář na osobním účtu | Kalendář v Google Workspace klienta |
| **Google Drive** | Složky na osobním Drive | Shared Drive v Google Workspace klienta |
| **Service Account** | `drservis-booking-sa@drservis-booking.iam.gserviceaccount.com` | Nový SA v klientově GCP projektu (nebo zachovat stávající) |

## 2. Co se NEMIGRUJE

- Supabase (databáze, auth, RLS) — beze změny
- Vercel (hosting, deployment) — beze změny
- Kód aplikace — pouze změna env proměnných

---

## 3. Předpoklady na straně klienta

### 3.1 Google Workspace
- [ ] Klient má aktivní Google Workspace (Business Starter nebo vyšší)
- [ ] Přístup do Google Admin Console (admin.google.com)
- [ ] Přístup do Google Cloud Console (console.cloud.google.com)

### 3.2 Potřebná oprávnění
- [ ] Admin práva v Google Workspace
- [ ] Možnost vytvářet GCP projekty nebo přístup do existujícího
- [ ] Možnost vytvářet Service Accounty
- [ ] Možnost povolovat Google API

---

## 4. Krok za krokem

### FÁZE 1: Příprava GCP projektu klienta

#### 4.1 Vytvoření GCP projektu
1. Jít na https://console.cloud.google.com
2. Přihlásit se klientovým Workspace admin účtem
3. Vytvořit nový projekt: **"DRServis Booking"**
4. Zapamatovat si Project ID

#### 4.2 Povolení API
V sekci **APIs & Services → Library** povolit:
- [x] Google Calendar API
- [x] Google Drive API
- [x] Google Docs API (pro info soubory v Drive)

#### 4.3 Vytvoření Service Accountu
1. **APIs & Services → Credentials → Create Credentials → Service Account**
2. Název: `drservis-booking-sa`
3. Popis: "Service account pro DRServis Booking aplikaci"
4. Vytvořit
5. **Vytvořit klíč:**
   - Kliknout na nový SA → Keys → Add Key → Create new key
   - Typ: **JSON**
   - Stáhne se soubor s credentials
6. Z JSON souboru si poznamenat:
   - `client_email` → nová hodnota pro `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → nová hodnota pro `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

---

### FÁZE 2: Nastavení Google Calendar

#### 4.4 Vytvoření kalendáře
1. Jít na https://calendar.google.com (přihlášen jako klient)
2. Vlevo → **"Další kalendáře" → "+" → Vytvořit nový kalendář**
3. Název: **"DR Servis – Booking"** (nebo dle přání klienta)
4. Časové pásmo: **Europe/Prague**
5. Vytvořit

#### 4.5 Zjistit Calendar ID
1. Nastavení kalendáře → **Integrace kalendáře**
2. Zkopírovat **Calendar ID** (formát: `xxxxx@group.calendar.google.com`)
3. Toto bude nová hodnota pro `GOOGLE_CALENDAR_ID`

#### 4.6 Sdílet kalendář se Service Accountem
1. Nastavení kalendáře → **Sdílet s konkrétními lidmi**
2. Přidat: email nového Service Accountu (z kroku 4.3)
3. Oprávnění: **"Provádět změny a spravovat sdílení"** (Make changes and manage sharing)
4. Uložit

#### 4.7 (Volitelné) Sdílet kalendář s uživateli
- Přidat uživatele klienta kteří mají vidět kalendář
- Oprávnění dle potřeby (čtení / zápis)

---

### FÁZE 3: Nastavení Google Drive

#### 4.8 Vytvoření Shared Drive
> **Důležité:** Service Account nemá kvótu na osobním Drive. Musí se použít Shared Drive!

1. Jít na https://drive.google.com
2. **Sdílené disky** (Shared drives) → **Nový sdílený disk**
3. Název: **"DR Servis Booking – Podklady"**
4. Vytvořit

#### 4.9 Přidat Service Account do Shared Drive
1. Kliknout na nový Shared Drive → **Spravovat členy**
2. Přidat email Service Accountu z kroku 4.3
3. Role: **Správce obsahu** (Content Manager) nebo **Správce** (Manager)
4. Uložit

#### 4.10 Zjistit Folder ID
1. Otevřít Shared Drive v prohlížeči
2. Z URL zkopírovat ID: `https://drive.google.com/drive/folders/XXXXXXXXXXXXXX`
3. Toto `XXXXXXXXXXXXXX` bude nová hodnota pro `GOOGLE_DRIVE_PARENT_FOLDER_ID`

#### 4.11 (Volitelné) Aktivovat info soubory
Protože Shared Drive má kvótu, můžeme aktivovat vytváření `info_akce` souborů.
V souboru `src/lib/google/drive.ts` odkomentovat/povolit vytváření info souborů (řádky ~309-320).

---

### FÁZE 4: Migrace existujících dat

#### 4.12 Přesun existujících Drive složek
**Varianta A – Kopírování (doporučeno):**
1. Ve starém Drive vybrat všechny měsíční složky (2025-01, 2025-02, atd.)
2. Zkopírovat je do nového Shared Drive
3. Zachová se obsah, ale změní se ID složek
4. ⚠️ **Staré `drive_folder_id` v databázi budou neplatné!**
5. Spustit validaci: `POST /api/events/validate-drive` (smaže neplatné reference)
6. Pro důležité akce ručně vytvořit nové složky tlačítkem "Vytvořit podklady"

**Varianta B – Nechat staré složky:**
1. Staré složky nechat na původním Drive (read-only archiv)
2. Spustit `POST /api/events/validate-drive` → vyčistí neplatné reference
3. Pro budoucí akce se budou vytvářet složky na novém Shared Drive

> **Doporučení:** Varianta B je bezpečnější. Staré složky zůstanou dostupné pod původními odkazy, nové akce budou na novém Drive.

#### 4.13 Přesun existujících kalendářních událostí
**Není nutný!** Při dalším spuštění kalendářové synchronizace se automaticky:
1. Vytáhnou události z nového kalendáře
2. Staré události (se starým `google_event_id`) zůstanou v DB, ale:
   - Nebudou mít odpovídající událost v novém kalendáři
   - Při synchronizaci se automaticky odstraní z DB (pokud jsou v časovém rozsahu syncu)

**Doporučený postup:**
1. Ručně zkopírovat důležité budoucí události do nového kalendáře
2. Nebo: vytvořit nové události přímo v novém kalendáři
3. Spustit sync → nové události se nahrají do DB

---

### FÁZE 5: Aktualizace environment proměnných

#### 4.14 Aktualizace Vercel env vars
V Vercel dashboardu (Settings → Environment Variables) aktualizovat:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=<nový-sa-email>@<projekt>.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<nový-private-key>
GOOGLE_CALENDAR_ID=<nový-calendar-id>@group.calendar.google.com
GOOGLE_DRIVE_PARENT_FOLDER_ID=<nový-shared-drive-folder-id>
```

> **Pozor na Private Key:** V Vercel použít režim **"Sensitive"** a vložit klíč jako plain text (s `\n` v textu, ne skutečné nové řádky).

#### 4.15 Aktualizace lokálního .env.local
Stejné hodnoty aktualizovat v lokálním `.env.local` pro development.

#### 4.16 Redeploy
1. V Vercel spustit nový deployment (Settings → Deployments → Redeploy)
2. Nebo pushnout libovolný commit

---

### FÁZE 6: Verifikace

#### 4.17 Kontrolní checklist po migraci
- [ ] **Calendar sync:** Spustit synchronizaci kalendáře → události se načtou z nového kalendáře
- [ ] **Pozvánky:** Přiřadit technika k akci → přijde mu pozvánka z nového kalendáře
- [ ] **Status sync:** Technik odpoví na pozvánku → status se aktualizuje v aplikaci
- [ ] **Drive folder:** Vytvořit podklady pro akci → složka se vytvoří na novém Shared Drive
- [ ] **Drive attach:** Připojit podklady ke kalendáři → přílohy se objeví v kalendářové události
- [ ] **Files list:** V detailu akce se zobrazí soubory z Drive složky
- [ ] **Validate:** Spustit `POST /api/events/validate-drive` → zkontroluje platnost všech odkazů

---

## 5. Env proměnné – přehled

| Proměnná | Popis | Kde změnit |
|----------|-------|------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email Service Accountu | Vercel + .env.local |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Privátní klíč SA (JSON) | Vercel + .env.local |
| `GOOGLE_CALENDAR_ID` | ID cílového Google kalendáře | Vercel + .env.local |
| `GOOGLE_DRIVE_PARENT_FOLDER_ID` | ID root složky na Shared Drive | Vercel + .env.local |

---

## 6. Soubory v kódu které odkazují na Google

| Soubor | Funkce |
|--------|--------|
| `src/lib/google/auth.ts` | Autentizace Service Accountu |
| `src/lib/google/calendar.ts` | Calendar API operace |
| `src/lib/google/drive.ts` | Drive API operace |
| `src/lib/env.ts` | Validace env proměnných |
| `src/app/api/sync/calendar/route.ts` | Sync kalendáře do DB |
| `src/app/api/events/[id]/drive/route.ts` | CRUD Drive složek |
| `src/app/api/events/[id]/attach-drive/route.ts` | Připojení Drive ke kalendáři |
| `src/app/api/events/[id]/sync-status/route.ts` | Sync statusů pozvánek |
| `src/app/api/events/[id]/invite/route.ts` | Pozvánky techniků |
| `src/app/api/events/[id]/files/route.ts` | Seznam souborů v Drive |
| `src/app/api/events/validate-drive/route.ts` | Validace Drive odkazů |

---

## 7. Rizika a řešení

| Riziko | Dopad | Řešení |
|--------|-------|--------|
| Nesprávná oprávnění SA | API volání selžou (403) | Ověřit že SA je Editor na kalendáři a Manager na Shared Drive |
| Špatný Private Key formát | Aplikace nestartuje | V Vercel použít Sensitive mode, v .env.local obalit uvozovkami |
| Staré Drive odkazy v DB | "Složka nenalezena" chyby | Spustit validate-drive endpoint |
| Info file quota | Tvorba info_akce selže | Shared Drive má kvótu → bude fungovat |
| Staré kalendářní události | Zmizí z DB při syncu | Předem zkopírovat do nového kalendáře |

---

## 8. Časový odhad

| Fáze | Odhad |
|------|-------|
| Příprava GCP projektu + API | 15 min |
| Nastavení Calendar | 10 min |
| Nastavení Shared Drive | 10 min |
| Aktualizace env vars + redeploy | 10 min |
| Verifikace | 15 min |
| **Celkem** | **~1 hodina** |

---

## 9. Rollback plán

Pokud migrace selže:
1. Vrátit env proměnné na původní hodnoty (starý SA, starý Calendar ID, starý Drive folder)
2. Redeploy
3. Vše bude fungovat jako předtím

> Starý Google účet a jeho data se nemažou dokud není migrace ověřena.

---

## 10. Po úspěšné migraci

- [ ] Odebrat Service Account ze starého kalendáře
- [ ] (Volitelné) Smazat starý GCP projekt pokud není potřeba
- [ ] Nastavit billing alerting na klientově GCP projektu
- [ ] Dokumentovat nové credentials do interní dokumentace klienta
- [ ] Předat klientovi přístupy ke GCP Console
