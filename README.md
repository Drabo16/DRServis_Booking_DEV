# DR Servis Booking System

Webová aplikace pro správu bookingu techniků na akce s automatizací přes Google Workspace.

## 🚀 Technologie

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI
- **Backend/DB**: Supabase (PostgreSQL, Auth, RLS)
- **Integrace**: Google Calendar API, Google Drive API

## 📋 Hlavní funkce

1. **Synchronizace kalendáře** - Automatický import akcí z Google Calendar
2. **Booking systém** - Vytváření pozic a přiřazování techniků
3. **Automatické pozvánky** - Přidání techniků jako attendees v Google Calendar
4. **Sledování statusů** - Real-time monitoring přijetí/odmítnutí pozvánek
5. **Google Drive integrace** - Automatické vytváření složek pro akce

## 🛠️ Instalace a Setup

### 1. Nainstalujte závislosti

\`\`\`bash
npm install
\`\`\`

### 2. Nastavte Supabase

1. Vytvořte projekt na [supabase.com](https://supabase.com)
2. V Supabase SQL Editoru spusťte migraci:
   \`\`\`bash
   supabase/migrations/20260113_initial_schema.sql
   \`\`\`
3. Poznamenejte si URL a klíče projektu

### 3. Nastavte Google Cloud Service Account

1. Jděte do [Google Cloud Console](https://console.cloud.google.com)
2. Vytvořte nový projekt nebo použijte existující
3. Aktivujte API:
   - Google Calendar API
   - Google Drive API
4. Vytvořte Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Stáhněte JSON klíč
5. Sdílejte firemní kalendář se Service Account emailem (jako Editor)
6. Sdílejte rodičovskou složku na Drive se Service Account emailem

### 4. Nastavte Environment Variables

Vytvořte soubor \`.env.local\`:

\`\`\`bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Service Account (z JSON klíče)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# Google Calendar & Drive
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_DRIVE_PARENT_FOLDER_ID=your-drive-folder-id

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-random-secret
\`\`\`

### 5. Vytvořte prvního admina

Po spuštění aplikace:
1. Zaregistrujte se přes Supabase Auth UI nebo přímo v databázi
2. V Supabase Table Editor najděte tabulku \`profiles\`
3. Vytvořte záznam s vaším \`user.id\` a nastavte \`role = 'admin'\`

### 6. Spusťte aplikaci

\`\`\`bash
npm run dev
\`\`\`

Aplikace běží na [http://localhost:3000](http://localhost:3000)

## 📖 Použití

### Pro Administrátory

1. **Synchronizace akcí**
   - Klikněte na tlačítko "Synchronizovat" v hlavičce
   - Načte akce z Google Calendar za následujících 90 dní

2. **Vytvoření pozic**
   - Otevřete detail akce
   - Klikněte "Přidat pozici"
   - Vyplňte název, typ role, sazbu

3. **Přiřazení techniků**
   - Na kartě pozice klikněte "Přiřadit"
   - Vyberte technika ze seznamu
   - Po přiřazení klikněte na ikonu obálky pro odeslání pozvánky

4. **Vytvoření složky na Drive**
   - V detailu akce klikněte "Vytvořit podklady na Drive"
   - Automaticky vytvoří strukturu: Podklady, Foto, Video, Dokumenty

5. **Kontrola statusů**
   - Klikněte "Obnovit statusy" pro načtení odpovědí z Google Calendar
   - Statusy se zobrazí barevně: zelená (přijato), červená (odmítnuto), žlutá (čeká)

### Pro Techniky

- Vidí všechny akce a své přiřazení
- Mohou prohlížet detaily akcí a kontakty ostatních techniků
- Odpovídají na pozvánky přímo v Google Calendar

## 🏗️ Architektura

\`\`\`
src/
├── app/
│   ├── (dashboard)/        # Authenticated routes
│   │   ├── events/         # Event pages
│   │   └── technicians/    # Technician list
│   ├── api/                # API routes
│   │   ├── sync/           # Calendar sync
│   │   ├── events/         # Event CRUD + Drive + Invites
│   │   ├── positions/      # Position CRUD
│   │   └── assignments/    # Assignment CRUD
│   └── login/              # Auth page
├── components/
│   ├── ui/                 # Shadcn/UI components
│   ├── events/             # Event components
│   ├── positions/          # Position components
│   └── layout/             # Layout components
├── lib/
│   ├── supabase/           # Supabase clients
│   ├── google/             # Google API wrappers
│   ├── utils.ts            # Utility functions
│   └── constants.ts        # App constants
└── types/                  # TypeScript types
\`\`\`

## 🔒 Zabezpečení

- **RLS (Row Level Security)** v Supabase
- **Server-side API routes** pro citlivé operace
- **Service Account** pro Google API (bez user credentials)
- **Middleware** pro ochranu routes

## 📝 TODO / Budoucí rozšíření

- [ ] Dashboard s přehledem statistik
- [ ] Export do PDF/Excel
- [ ] Notifikace (email/push)
- [ ] Kalendářní view akcí
- [ ] Mobilní aplikace
- [ ] Automatické reporty
- [ ] Fakturace

## 🐛 Troubleshooting

### Chyba: "Failed to fetch calendar events"
- Zkontrolujte, že Service Account má přístup ke kalendáři
- Ověřte správnost \`GOOGLE_CALENDAR_ID\`

### Chyba: "Failed to create folder"
- Zkontrolujte, že Service Account má přístup k Drive složce
- Ověřte správnost \`GOOGLE_DRIVE_PARENT_FOLDER_ID\`

### Pozvánky se neposílají
- Ověřte, že technik má správný email v profilu
- Zkontrolujte Google Calendar API kvóty

## 📄 Licence

Proprietární - DR Servis

## 👨‍💻 Kontakt

Pro podporu kontaktujte administrátora systému.
