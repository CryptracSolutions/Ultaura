# RLS (Row-Level Security) Checks

## What to Look For

### 1. RLS Enabled on Every Table
- Every `CREATE TABLE` must be followed by `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`
- **How to verify**: Search migration files for `CREATE TABLE` and confirm each has a corresponding `ENABLE ROW LEVEL SECURITY`

### 2. Policy Scoping
- At least one RLS policy per table, scoped to account ownership
- Standard pattern: `using (is_ultaura_account_owner(account_id))`
- Health tables add: `and can_access_ultaura_health_line(line_id)`
- **Pattern to flag**: Policies with `using (true)` or no `WHERE`/`USING` clause

### 3. auth.uid() Wrapping
- All `auth.uid()` calls in policies MUST be wrapped in `(select auth.uid())`
- Similarly: `(select auth.role())`, `(select auth.jwt())`
- **Why**: Bare `auth.uid()` is re-evaluated per row, causing performance issues (Supabase lint 0003)
- **How to verify**: `grep -n "auth.uid()" migration.sql` — flag any not wrapped in `(select ...)`

### 4. SECURITY DEFINER Functions
- All `SECURITY DEFINER` functions must include `SET search_path = public`
- **Why**: Prevents search-path hijacking where a malicious schema could intercept function calls
- **How to verify**: `grep -A2 "SECURITY DEFINER" migration.sql` — confirm `SET search_path = public` follows

### 5. Helper Functions
- Standard helpers (already defined, should be reused):
  - `is_ultaura_account_owner(target_account_id uuid)` — checks `auth.uid()` against `ultaura_accounts.created_by_user_id`
  - `can_access_ultaura_health_line(target_line_id uuid)` — joins lines → accounts, checks ownership
- **Pattern to flag**: New policies that re-implement ownership checks instead of using these helpers

### 6. Health Table Triggers
- Health tables must have `enforce_health_account_line_consistency()` trigger
- **What it does**: Raises exception if `line_id` doesn't belong to `account_id` at the DB layer
- **Pattern to flag**: New health table without this trigger

### 7. Access Classifications
- Class 1: owner-readable, no direct browser writes
- Class 2: owner-readable history, no direct writes
- Class 3: service-managed lifecycle, owner read-only
- New tables should document their access class in comments

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Missing RLS | `CREATE TABLE foo (...)` with no `ENABLE ROW LEVEL SECURITY` | Add `ALTER TABLE foo ENABLE ROW LEVEL SECURITY` |
| Bare auth.uid() | `using (account_id = auth.uid())` | Change to `using (account_id = (select auth.uid()))` |
| Missing search_path | `SECURITY DEFINER` function without `SET search_path` | Add `SET search_path = public` |
| Custom ownership check | New `WHERE created_by = auth.uid()` instead of helper | Use `is_ultaura_account_owner(account_id)` |
