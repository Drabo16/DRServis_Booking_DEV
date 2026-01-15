# Recovery Instructions - DR Servis Booking

Tento dokument obsahuje instrukce pro obnovu aplikace.

## Důležité zálohovací body

| Commit | Hash | Popis |
|--------|------|-------|
| V2 Complete | `6e398c3` | Aktuální stav - V2 s opravami |
| V2 Initial | `8398f8e` | První verze V2 |
| Pre-V2 Backup | `074f20d` | Stav před V2 upgrade |

## Jak obnovit aplikaci

### Varianta 1: Úplná obnova do Pre-V2 stavu

```bash
# Zobrazí aktuální stav
git status

# Zahodí všechny změny a vrátí se na Pre-V2
git reset --hard 074f20d
```

### Varianta 2: Vytvoření nové větve se starým stavem

```bash
# Vytvoří novou větev ze starého stavu
git checkout -b pre-v2-backup 074f20d

# Pro přepnutí zpět na master
git checkout master
```

### Varianta 3: Obnovení konkrétních souborů

```bash
# Obnovit konkrétní soubor ze zálohy
git checkout 074f20d -- cesta/k/souboru.tsx

# Například:
git checkout 074f20d -- src/components/events/ExcelView.tsx
```

## V2 Změny (přehled)

### Fáze 1: Google Drive integrace
- Měsíční organizace složek (YYYY-MM)
- Automatické vytvoření `info_akce.txt`
- Příloha Drive složky do Google Calendar (attachment, ne odkaz)

### Fáze 2: Excel View redesign
- Dynamické sloupce podle role_types z databáze
- Rychlejší auto-save (2s místo 5s)
- Multiselect s bulk akcemi
- Horizontální scrollbar

### Fáze 3: Dynamické role
- Role se načítají z databáze (`role_types` tabulka)
- Nastavení rolí v Settings

## Historie commitů

Pro zobrazení historie:
```bash
git log --oneline -20
```

## Struktura projektu

```
src/
├── app/
│   ├── api/
│   │   ├── events/[id]/
│   │   │   ├── drive/          # Google Drive API
│   │   │   ├── attach-drive/   # Připojení Drive ke kalendáři
│   │   │   ├── files/          # Seznam souborů
│   │   │   └── sync-status/    # Synchronizace statusů
│   │   ├── role-types/         # CRUD pro typy rolí
│   │   └── ...
│   └── (dashboard)/
│       ├── events/             # Události
│       ├── settings/           # Nastavení (role types)
│       └── ...
├── components/
│   ├── events/
│   │   ├── ExcelView.tsx       # Excel-like rozhraní
│   │   ├── EventDetailPanel.tsx
│   │   └── ...
│   └── positions/
│       └── PositionsManager.tsx
└── lib/
    └── google/
        ├── calendar.ts         # Google Calendar API
        └── drive.ts            # Google Drive API
```

## Kontakt

V případě problémů zkontrolujte git log a vyhledejte příslušný commit.
