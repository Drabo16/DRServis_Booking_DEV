# Performance Audit - DRServis Booking

**Date:** 2026-02-14
**Trigger:** Supabase Performance Advisor reported 102 RLS policy warnings + `pg_timezone_names` query consuming 21.5% of DB time

---

## Summary of Changes

### Phase 1: SQL Scripts (NOT executed - manual review required)

#### `supabase-rls-fix.sql`
- Rewrites 5 SQL functions to wrap `auth.uid()` in `(SELECT auth.uid())` — prevents per-row auth context initialization
- Drops and recreates 37 RLS policies across 18 tables with the same `(SELECT ...)` wrapper
- Wrapped in a `BEGIN; ... COMMIT;` transaction for atomicity
- Includes diagnostic verification query at the end
- **Expected impact:** Eliminates 102 Supabase Performance Advisor warnings

**Functions rewritten:**
- `is_supervisor()`, `has_module_access()`, `has_warehouse_access()`, `has_offers_access()`, `has_permission()`

**Tables affected:**
profiles, events, positions, assignments, sync_logs, app_modules, user_module_access, warehouse_categories, warehouse_items, warehouse_kits, warehouse_kit_items, warehouse_reservations, offer_template_categories, offer_template_items, offers, offer_items, offer_sets, user_permissions

#### `supabase-indexes.sql`
- 5 missing indexes for frequently queried columns:
  - `idx_supervisor_emails_email_lower` — functional index for ILIKE lookups (queried 15+ times per request)
  - `idx_user_permissions_user_permission` — composite index for exact permission checks
  - `idx_profiles_email` — email fallback lookups
  - `idx_profiles_is_active` — partial index for active technician filtering
  - `idx_assignments_position_technician` — nested join optimization
- Includes diagnostic queries for the `pg_timezone_names` issue

### Phase 2: Server Helpers Optimization

**File:** `src/lib/supabase/server.ts`

| Change | Impact |
|--------|--------|
| Added `checkIsSupervisor(email)` | Replaces 15+ duplicate supervisor_emails lookups across API routes |
| Added `getAuthContext(supabase)` | Combines 3-step auth boilerplate (getUser + getProfileWithFallback + supervisorCheck) used in ~20 routes |
| Added `isSupervisor` parameter to `hasPermission()` | Avoids redundant supervisor re-check when already known |
| Rewrote `hasAllPermissions()` / `hasAnyPermission()` | Single batch query via `.in('permission_code', codes)` instead of N+1 loop (was 2 queries per permission) |
| Added `PROFILE_COLUMNS` constant | Explicit column list replacing `select('*')` in profile queries |

**API routes updated (12 files, ~20 handlers):**
- `api/events/route.ts` — getAuthContext
- `api/permissions/me/route.ts` — getAuthContext + Promise.all (4 parallel queries)
- `api/permissions/user/[userId]/route.ts` — checkIsSupervisor + Promise.all (5 parallel queries)
- `api/modules/accessible/route.ts` — getAuthContext + Promise.all (2 parallel queries)
- `api/sync/calendar/route.ts` — getAuthContext
- `api/users/route.ts` — getAuthContext (both GET and POST)
- `api/users/[id]/route.ts` — getAuthContext (both PATCH and DELETE)
- `api/users/import/route.ts` — getAuthContext
- `api/technicians/assignments/route.ts` — getAuthContext
- `api/role-types/route.ts` — getAuthContext (POST handler)
- `(dashboard)/page.tsx` — getAuthContext
- `(dashboard)/settings/page.tsx` — getAuthContext + Promise.all (5 parallel queries)
- `(dashboard)/settings/roles/page.tsx` — getAuthContext

### Phase 3: Data Fetching Optimization

#### select('*') → explicit columns (8 high-impact instances)
- `api/technicians/route.ts` — profiles select
- `api/users/route.ts` — profiles select
- `api/permissions/route.ts` — permission_types select
- `api/role-types/route.ts` — role_types select
- `events/[id]/page.tsx` — allTechnicians select
- `settings/roles/page.tsx` — roleTypes select
- `AssignTechnicianDialog.tsx` — profiles select
- `server.ts` getProfileWithFallback — uses PROFILE_COLUMNS constant

#### Sequential → Parallel fetches (4 routes)
- `api/permissions/me/route.ts` — 4 sequential queries → Promise.all
- `api/permissions/user/[userId]/route.ts` — supervisor + 4 queries → Promise.all
- `api/modules/accessible/route.ts` — user modules + core modules → Promise.all
- `settings/page.tsx` — 4 stats + last sync → Promise.all

### Phase 4: Frontend & Next.js

#### Loading skeletons (8 new files)
- `(dashboard)/loading.tsx` — Main events list
- `(dashboard)/warehouse/loading.tsx` — Warehouse table
- `(dashboard)/offers/loading.tsx` — Offers grid
- `(dashboard)/users/loading.tsx` — Users table
- `(dashboard)/settings/loading.tsx` — Settings cards
- `(dashboard)/settings/roles/loading.tsx` — Roles list
- `(dashboard)/calendar/loading.tsx` — Calendar grid
- `(dashboard)/technicians/loading.tsx` — Technicians list

#### React Query staleTime tuning
- `useModules()` — added `staleTime: 10 * 60 * 1000` (modules rarely change, was using 0ms default)
- `useAccessibleModules()` — already had 5min staleTime (unchanged)

#### Cache headers (next.config.js)
- Added `Cache-Control: public, max-age=31536000, immutable` for `/images/*` and `/fonts/*`

---

## How to Apply SQL Scripts

**IMPORTANT:** Review the scripts before executing. They are NOT executed automatically.

1. Open Supabase Dashboard → SQL Editor
2. Run `supabase-indexes.sql` first (safe, CREATE IF NOT EXISTS)
3. Review `supabase-rls-fix.sql` carefully — it drops and recreates RLS policies
4. Run `supabase-rls-fix.sql` in a single transaction
5. Verify with the diagnostic query at the end of the RLS fix script

---

## Testing Checklist

- [ ] Login/logout works
- [ ] Events list loads (main page)
- [ ] Event detail page works (view positions, assignments)
- [ ] Calendar view works
- [ ] Technician overview tab works
- [ ] Technician calendar tab works
- [ ] User management (CRUD) works
- [ ] Permissions page works (view + edit)
- [ ] Settings page loads with statistics
- [ ] Role types management works
- [ ] Warehouse module works
- [ ] Offers module works
- [ ] Calendar sync works
- [ ] Loading skeletons appear during page transitions

---

## Expected Performance Impact

| Area | Before | After |
|------|--------|-------|
| RLS policy evaluation | `auth.uid()` re-evaluated per row | Evaluated once per query via `(SELECT ...)` |
| Permission checks (N permissions) | 2N+1 DB queries (N supervisor checks + N permission queries + 1 profile) | 3 DB queries (1 profile + 1 supervisor + 1 batch permission) |
| /api/permissions/me | 5 sequential queries | 1 auth + 4 parallel queries |
| /api/modules/accessible | 4 sequential queries | 1 auth + 2 parallel queries |
| Settings page | 7 sequential queries | 1 auth + 5 parallel queries |
| Data transfer | `SELECT *` on all tables | Explicit columns only |
| Page transitions | White screen until JS loads | Instant skeleton feedback |
| Module data freshness | Refetched every 0ms | Cached for 10 minutes |
| Static assets | Default caching | 1-year immutable cache |
