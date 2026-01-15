# Recovery Instructions - V2 Upgrade

Tento dokument obsahuje instrukce pro obnovu aplikace do stavu před V2 upgrade.

## Pre-V2 Backup Commit

Commit hash: `074f20d` (Pre-V2 Backup)

## Jak obnovit aplikaci do stavu před V2

### Varianta 1: Úplná obnova (zahodí všechny V2 změny)

```bash
# Zobrazí aktuální stav
git status

# Zahodí všechny neuložené změny
git reset --hard 074f20d

# Nebo pokud znáte přesný hash commitu:
git checkout 074f20d
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

## Důležité soubory před V2

- `src/components/events/ExcelView.tsx` - Excel view komponenta
- `src/app/api/role-types/route.ts` - API pro role types
- `src/lib/constants.ts` - Konstanty včetně ROLE_TYPES

## Historie commitů

Pro zobrazení historie:
```bash
git log --oneline -20
```

## Kontakt

V případě problémů zkontrolujte git log a vyhledejte commit "Pre-V2 Backup".
