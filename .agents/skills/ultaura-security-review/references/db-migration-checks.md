# Database Migration Checks

## What to Look For

### 1. Naming Convention
- Format: `YYYYMMDDHHMMSS_snake_case_description.sql`
- Example: `20260317143022_add_health_profile_table.sql`
- **Pattern to flag**: Non-conforming names, missing timestamps, camelCase

### 2. Table Security (Every New Table)
Required for EVERY new table:
1. `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
2. At least one RLS policy scoped to `auth.uid()` (via helper functions)
3. If storing sensitive data: encryption columns

### 3. Encryption Columns
For tables storing sensitive data, use one of these patterns:

**Standard pattern** (non-health):
```sql
encrypted_data text,
encrypted_data_key text
```

**Health pattern**:
```sql
payload_ciphertext text NOT NULL,
payload_iv text NOT NULL,
payload_tag text NOT NULL,
payload_alg text NOT NULL DEFAULT 'aes-256-gcm',
payload_kid text NOT NULL
```

**Pattern to flag**: Plaintext columns for data that should be encrypted (personal data, health data, memories, insights, call content)

### 4. Idempotency and Rollback
- Use `IF NOT EXISTS` for `CREATE TABLE`, `CREATE INDEX`
- Use `IF EXISTS` for `DROP` operations
- Avoid irreversible data mutations without backup strategy
- **Pattern to flag**: `DROP TABLE` without `IF EXISTS`, `ALTER TABLE DROP COLUMN` on production data

### 5. Index Safety
- Avoid duplicating indexes that are implicit from UNIQUE constraints
- Use `CONCURRENTLY` for indexes on large tables (prevents table locks)
- **Pattern to flag**: Index on columns that already have a UNIQUE constraint

### 6. Function Security
- All `SECURITY DEFINER` functions: `SET search_path = public`
- Prefer `SECURITY INVOKER` unless the function needs elevated privileges
- **Pattern to flag**: `SECURITY DEFINER` without search_path, or unnecessary use of `SECURITY DEFINER`

### 7. Data Types
- UUIDs for all IDs: `uuid DEFAULT gen_random_uuid()`
- Timestamps: `timestamptz DEFAULT now()` (not `timestamp` without timezone)
- **Pattern to flag**: `serial`/`bigserial` for IDs, `timestamp` without `tz`

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Missing RLS | New table without `ENABLE ROW LEVEL SECURITY` | Add RLS + policy |
| Plaintext sensitive data | `notes text` column for health observations | Use encryption columns |
| Non-idempotent | `CREATE TABLE foo` (no IF NOT EXISTS) | Add `IF NOT EXISTS` |
| Timestamp without tz | `created_at timestamp DEFAULT now()` | Use `timestamptz` |
