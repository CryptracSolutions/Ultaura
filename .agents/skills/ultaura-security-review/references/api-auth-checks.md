# API Authentication Checks

## What to Look For

### 1. Browser-Facing Routes
Every route in `src/app/api/` that serves browser requests must:
1. Create Supabase client: `const supabase = getSupabaseRouteHandlerClient()`
2. Verify user: `const { data: authData, error: authError } = await supabase.auth.getUser()`
3. Check result: `if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
4. Verify ownership: Query `ultaura_accounts` to confirm `created_by_user_id === authData.user.id`

**Pattern to flag**:
- Using `getSession()` instead of `getUser()` — `getSession()` reads from the JWT and can be stale
- Missing ownership verification after auth — RLS alone is defense-in-depth, but app code must also verify
- Using the browser Supabase client on the server

### 2. Internal/Telephony Routes
Routes in `src/app/api/telephony/` or internal webhook handlers must:
1. Validate webhook secret: `validateWebhookSecret(request)` using `ULTAURA_INTERNAL_API_SECRET`
2. Use timing-safe comparison: `crypto.timingSafeEqual(provided, expected)`

**Pattern to flag**:
- Direct string comparison (`===`) for secrets or tokens — vulnerable to timing attacks
- Missing webhook secret validation on telephony routes

### 3. Admin Routes
Routes serving admin functionality must:
1. Extract JWT: `(select auth.jwt()) -> 'app_metadata' ->> 'role'`
2. Verify role: `=== 'super-admin'`

**Pattern to flag**: Admin routes accessible without role verification

### 4. Server Client Usage
- Server-side code must use `getSupabaseRouteHandlerClient()` from `src/lib/server/`
- `import 'server-only'` at the top of server-side route files
- **Pattern to flag**: Importing from `@supabase/ssr` directly, or using `createBrowserClient` on the server

### 5. Error Response Patterns
- Sensitive routes (health, privacy, documents) should return `404 Not Found` even for auth failures
- **Why**: Returning `403 Forbidden` reveals that the resource exists, which is PII leakage for health data
- Non-sensitive routes can use standard `401`/`403` responses

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Stale session | `supabase.auth.getSession()` | Use `supabase.auth.getUser()` |
| Missing ownership | Auth check but no `created_by_user_id` verification | Add ownership query after auth |
| Timing attack | `if (secret === expectedSecret)` | Use `crypto.timingSafeEqual()` |
| Existence disclosure | `return NextResponse.json({ error: 'Forbidden' }, { status: 403 })` on health route | Return `{ error: 'Not found' }` with status 404 |
