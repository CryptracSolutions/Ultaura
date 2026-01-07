# Spec: Short Line ID Column Implementation

## Problem Statement

The current `getLine()` function in `/src/lib/ultaura/lines.ts` uses an inefficient pattern for short ID lookups:

```typescript
if (lineId.length === 8) {
  // Fetches ALL lines from database, then filters client-side
  const result = await client.from('ultaura_lines').select('*');
  const match = result.data.find(line =>
    line.id.toLowerCase().startsWith(lineId.toLowerCase())
  );
}
```

**Issues:**
1. **Performance**: O(n) database fetch for every short ID lookup - fetches all lines then filters in memory
2. **Collision Risk**: Two UUIDs could share the same 8-character prefix (1 in ~16M chance per pair)
3. **Scalability**: Doesn't scale for B2B/facility mode with many lines per account

**Impact**: Medium (facility mode / many lines)
**Likelihood**: Medium (B2B later, or family with multiple)
**Symptoms**: Wrong line opens, slow page loads

---

## Objective

Add a dedicated `short_id` column to `ultaura_lines` with proper indexing and unique constraints, enabling direct database queries instead of client-side filtering.

---

## Technical Requirements

### 1. Database Schema Changes

**New Column: `short_id`**
- Type: `text`
- Nullable: `NOT NULL`
- Default: None (generated at insert time)
- Format: 8 lowercase alphanumeric characters (derived from UUID prefix)
- Collision format: `{base}_2`, `{base}_3`, etc. (underscore + increment)

**Constraints:**
- `UNIQUE (account_id, short_id)` - Unique within each account
- No global uniqueness constraint (same short_id may exist across different accounts)

**Index:**
- Standard btree index on `short_id` column for global lookups
- The composite unique constraint automatically creates an index on `(account_id, short_id)`

### 2. Short ID Format Specification

| Property | Value |
|----------|-------|
| Length | 8 characters (base), up to 10 with suffix |
| Character Set | `a-z`, `0-9` (lowercase alphanumeric only) |
| Generation | First 8 chars of UUID, lowercased |
| Collision Handling | Append `_2`, `_3`, etc. |
| Case Sensitivity | Case-insensitive storage (all lowercase) |

**Examples:**
- UUID `A1B2C3D4-e5f6-4a7b-8c9d-0e1f2a3b4c5d` → short_id `a1b2c3d4`
- Collision: `a1b2c3d4`, `a1b2c3d4_2`, `a1b2c3d4_3`

### 3. Uniqueness Scope

| Scope | Constraint |
|-------|------------|
| Per Account | **UNIQUE** - Enforced via database constraint |
| Global | **Best effort** - Attempt uniqueness, but allow duplicates across accounts |
| Admin Lookup | Global search returns all matches (may be multiple from different accounts) |

---

## Implementation Approach

### Phase 1: Database Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_short_id_to_lines.sql`

```sql
-- Add short_id column
ALTER TABLE ultaura_lines
ADD COLUMN short_id text;

-- Populate short_id for existing lines
-- Uses first 8 chars of UUID, handles collisions with _N suffix
WITH ranked_lines AS (
  SELECT
    id,
    account_id,
    LOWER(SUBSTRING(id::text, 1, 8)) as base_short_id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, LOWER(SUBSTRING(id::text, 1, 8))
      ORDER BY created_at
    ) as collision_rank
  FROM ultaura_lines
)
UPDATE ultaura_lines l
SET short_id = CASE
  WHEN r.collision_rank = 1 THEN r.base_short_id
  ELSE r.base_short_id || '_' || r.collision_rank
END
FROM ranked_lines r
WHERE l.id = r.id;

-- Add NOT NULL constraint after population
ALTER TABLE ultaura_lines
ALTER COLUMN short_id SET NOT NULL;

-- Add unique constraint (per account)
ALTER TABLE ultaura_lines
ADD CONSTRAINT ultaura_lines_account_short_id_unique
UNIQUE (account_id, short_id);

-- Add index for global lookups
CREATE INDEX idx_ultaura_lines_short_id ON ultaura_lines (short_id);
```

### Phase 2: Short ID Generation Function

**File:** `/src/lib/ultaura/short-id.ts`

Update the existing file to include generation logic:

```typescript
/**
 * Generate a short_id from a UUID.
 * Takes first 8 characters, lowercased.
 */
export function generateShortId(uuid: string): string {
  return uuid.substring(0, 8).toLowerCase();
}

/**
 * Extract display short_id from a line.
 * @deprecated Use line.short_id directly after migration
 */
export function getShortLineId(lineId: string): string {
  return lineId.substring(0, 8).toLowerCase();
}

/**
 * Check if a string looks like a short_id (8-10 chars, alphanumeric + underscore)
 */
export function isShortId(id: string): boolean {
  return /^[a-z0-9]{8}(_\d+)?$/.test(id);
}

/**
 * Check if a string is a full UUID
 */
export function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
```

### Phase 3: Update Line Creation

**File:** `/src/lib/ultaura/lines.ts` - `createLine` function

Add collision-aware short_id generation:

```typescript
export async function createLine(data: CreateLineInput): Promise<LineRow> {
  const client = getSupabaseServerClient();

  // Generate initial short_id from the new UUID
  const lineId = crypto.randomUUID();
  let shortId = generateShortId(lineId);

  // Check for collision within account
  const { data: existing } = await client
    .from('ultaura_lines')
    .select('short_id')
    .eq('account_id', data.accountId)
    .like('short_id', `${shortId}%`);

  if (existing && existing.length > 0) {
    // Find next available suffix
    const usedSuffixes = existing.map(e => {
      const match = e.short_id.match(/_(\d+)$/);
      return match ? parseInt(match[1]) : 1;
    });
    const nextSuffix = Math.max(...usedSuffixes) + 1;
    shortId = `${shortId}_${nextSuffix}`;
  }

  const { data: line, error } = await client
    .from('ultaura_lines')
    .insert({
      id: lineId,
      short_id: shortId,
      account_id: data.accountId,
      // ... other fields
    })
    .select()
    .single();

  // ... error handling
}
```

### Phase 4: Update Line Lookup

**File:** `/src/lib/ultaura/lines.ts` - `getLine` function

Replace the inefficient lookup with direct query:

```typescript
import { isShortId, isUUID } from './short-id';

export async function getLine(lineId: string): Promise<LineRow | null> {
  const client = getSupabaseServerComponentClient();

  let query = client.from('ultaura_lines').select('*');

  if (isUUID(lineId)) {
    // Full UUID lookup
    query = query.eq('id', lineId);
  } else if (isShortId(lineId)) {
    // Short ID lookup - direct indexed query
    query = query.eq('short_id', lineId.toLowerCase());
  } else {
    // Invalid format
    logger.warn({ lineId }, 'Invalid line ID format');
    return null;
  }

  const { data, error } = await query.single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to get line');
    return null;
  }

  return data;
}
```

### Phase 5: Update URL Generation

**Files to update:**
- `/src/app/dashboard/(app)/lines/components/LineCard.tsx`
- `/src/app/dashboard/(app)/lines/components/AddLineModal.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx`
- `/src/app/dashboard/(app)/page.tsx`
- `/src/app/dashboard/(app)/reminders/RemindersPageClient.tsx`
- `/src/app/dashboard/(app)/calls/CallsPageClient.tsx`

**Change pattern:**
```typescript
// Before
const shortId = getShortLineId(line.id);
const href = `/dashboard/lines/${shortId}`;

// After
const href = `/dashboard/lines/${line.short_id}`;
```

### Phase 6: Update TypeScript Types

**File:** `/src/lib/ultaura/types.ts`

```typescript
export interface Line {
  id: string;
  shortId: string;  // Add new field
  accountId: string;
  // ... rest of fields
}

// Database row type
export interface LineRow {
  id: string;
  short_id: string;  // Add new field (snake_case for DB)
  account_id: string;
  // ... rest of fields
}
```

### Phase 7: Update revalidatePath Calls

**Files:**
- `/src/lib/ultaura/reminders.ts`
- `/src/lib/ultaura/contacts.ts`

**Change pattern:**
```typescript
// Before
const getShortLineId = (lineId: string) => lineId.substring(0, 8);
revalidatePath(`/dashboard/lines/${getShortLineId(lineId)}/reminders`);

// After
// Lookup line.short_id or pass it as parameter
revalidatePath(`/dashboard/lines/${line.short_id}/reminders`);
```

---

## API Changes

### Dashboard Actions (Accept Both Formats)

**File:** `/src/lib/ultaura/actions.ts`

All functions that accept `lineId` parameter should accept both formats:
- Full UUID: `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d`
- Short ID: `a1b2c3d4` or `a1b2c3d4_2`

Resolution happens in `getLine()` which is already called by most functions.

### Telephony Backend (Full UUID Only)

**No changes required** - Telephony backend at `/telephony/` continues to use full UUIDs only. The `short_id` is purely for dashboard URLs.

---

## Migration Strategy

### Breaking Change Notice

Old URLs using UUID prefix will **stop working** after deployment:
- Old: `/dashboard/lines/a1b2c3d4` (UUID prefix match)
- New: `/dashboard/lines/a1b2c3d4` (exact short_id match)

Most users will not notice since the format is the same. Only edge cases where collision handling adds suffix will differ.

### Deployment Steps

1. Run database migration (adds column, populates data, adds constraints)
2. Deploy updated application code
3. Old bookmarks pointing to UUID prefixes may break (accepted trade-off)

### Rollback Plan

If issues arise:
1. Remove `NOT NULL` constraint from `short_id`
2. Revert application code to use old `getLine()` logic
3. The `short_id` column can remain for future use

---

## Error Handling

### Invalid Line ID Format
- Return `null` from `getLine()`
- Log warning with invalid ID
- Page components redirect to 404

### Line Not Found (Valid Format, No Match)
- Return `null` from `getLine()`
- Page components show standard 404 page
- No redirect to lines list

### Collision During Creation
- Handled automatically with suffix
- No user-facing error
- Logged for monitoring (existing error logging)

---

## Edge Cases

### 1. Multiple Lines With Same UUID Prefix
- First line: `a1b2c3d4`
- Second line: `a1b2c3d4_2`
- Third line: `a1b2c3d4_3`
- URLs remain distinct and functional

### 2. Case Sensitivity
- URLs are case-insensitive: `/dashboard/lines/A1B2C3D4` resolves same as `/dashboard/lines/a1b2c3d4`
- Storage is always lowercase

### 3. Admin Global Lookup
- Admin searching `a1b2c3d4` may get multiple results from different accounts
- UI should show account context when displaying results

### 4. Line Deletion
- `short_id` is freed when line is deleted
- New line could reuse same `short_id` (acceptable)

### 5. Account Migration
- If lines move between accounts, `short_id` may conflict
- Collision handling applies (gets suffix)

---

## Testing Plan

**Manual Testing Checklist:**

1. **Create Line**
   - [ ] New line gets valid `short_id`
   - [ ] `short_id` appears in URL after creation
   - [ ] Line detail page loads correctly

2. **Collision Handling**
   - [ ] Create two lines with UUIDs sharing same prefix
   - [ ] Second line gets `_2` suffix
   - [ ] Both URLs work correctly

3. **URL Navigation**
   - [ ] Direct URL with `short_id` works
   - [ ] Direct URL with full UUID works
   - [ ] Invalid ID shows 404 page
   - [ ] Case variations (uppercase) work

4. **Dashboard Navigation**
   - [ ] Lines list links work
   - [ ] Reminders page links work
   - [ ] Calls page links work
   - [ ] Home page quick links work

5. **API Functions**
   - [ ] `getLine()` with short_id works
   - [ ] `getLine()` with UUID works
   - [ ] `getSchedules()` returns correct line data
   - [ ] `getReminders()` returns correct line data

6. **Data Migration**
   - [ ] All existing lines have `short_id` populated
   - [ ] No NULL values in `short_id` column
   - [ ] Collisions properly suffixed

---

## Files to Modify

### Database
| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_add_short_id_to_lines.sql` | New migration file |

### Core Library
| File | Change |
|------|--------|
| `/src/lib/ultaura/types.ts` | Add `shortId` to Line interface |
| `/src/lib/ultaura/short-id.ts` | Add `generateShortId`, `isShortId`, `isUUID` functions |
| `/src/lib/ultaura/lines.ts` | Update `getLine()` and `createLine()` |
| `/src/lib/ultaura/reminders.ts` | Update `revalidatePath` calls |
| `/src/lib/ultaura/contacts.ts` | Update `revalidatePath` calls |

### Dashboard Pages
| File | Change |
|------|--------|
| `/src/app/dashboard/(app)/lines/components/LineCard.tsx` | Use `line.short_id` |
| `/src/app/dashboard/(app)/lines/components/AddLineModal.tsx` | Use `line.short_id` |
| `/src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx` | Use `line.short_id` |
| `/src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx` | Use `line.short_id` |
| `/src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx` | Use `line.short_id` |
| `/src/app/dashboard/(app)/page.tsx` | Use `short_id` from data |
| `/src/app/dashboard/(app)/reminders/RemindersPageClient.tsx` | Use `short_id` from data |
| `/src/app/dashboard/(app)/calls/CallsPageClient.tsx` | Use `short_id` from data |

---

## Dependencies

- No new npm packages required
- Uses existing `crypto.randomUUID()` for ID generation
- Supabase client already supports all needed query operations

---

## Assumptions

1. Existing lines have valid UUIDs (standard format)
2. No lines currently share UUID prefix within same account (low probability)
3. Up to 10 lines per account in near term (collision handling is rare)
4. Users accept breaking change for old bookmarked URLs
5. Telephony backend does not need short_id support

---

## Success Criteria

1. **Performance**: `getLine()` executes single indexed query, not full table scan
2. **Correctness**: All existing URLs continue to work (with short_id column)
3. **Uniqueness**: No duplicate `short_id` values within any account
4. **Scalability**: Lookup remains O(1) regardless of line count

---

## Out of Scope

- Telephony backend changes
- Automated test suite
- Custom short_id selection by users
- URL redirect period for old bookmarks
- Additional logging/monitoring
