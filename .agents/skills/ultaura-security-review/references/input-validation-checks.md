# Input Validation Checks

## What to Look For

### 1. File Upload Validation
Any route accepting file uploads must implement ALL of these layers:
1. **MIME type allowlist**: Only accept explicitly allowed types (e.g., `application/pdf`, `image/jpeg`, `image/png`, `image/heic`)
2. **Extension-MIME match**: Verify the file extension matches the declared MIME type
3. **Magic byte verification**: Check actual file header bytes against declared MIME type using `verifyMagicBytes()`
4. **Size cap**: Enforce maximum file size (e.g., 25 MB for health documents)
5. **Rate limit**: Limit uploads per entity per time window (e.g., 10 uploads/line/hour)

**Reference implementation**: `src/app/api/health/documents/upload/route.ts`

### 2. UUID Validation
All ID parameters from user input (query params, path params, request body) must be validated:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```
**Pattern to flag**: Using raw user-provided IDs in database queries without UUID format validation

### 3. Timing-Safe Comparisons
All secret, token, or hash comparisons must use:
```typescript
crypto.timingSafeEqual(Uint8Array.from(providedBuffer), Uint8Array.from(expectedBuffer))
```
**Pattern to flag**: Using `===` or `!==` to compare secrets, tokens, API keys, or hashes

### 4. String Input Limits
- All user-provided strings should have length caps
- AI-generated content (suggestions, summaries) must go through `sanitizeSummaryParaphrase()`:
  - Strips quote wrappers and speaker labels
  - Rejects strings with remaining quote characters
  - Caps at 240 characters without cutting mid-word
- **Reference**: `src/lib/ultaura/health/sanitize.ts`

### 5. XSS Prevention
- React's JSX escaping handles most XSS by default
- **Pattern to flag**: `dangerouslySetInnerHTML` without DOMPurify or equivalent sanitization
- **Pattern to flag**: String interpolation into HTML strings outside of React components

### 6. SQL Injection Prevention
- Supabase client uses parameterized queries by default
- **Pattern to flag**: String concatenation in `.rpc()` calls or raw SQL queries
- **Pattern to flag**: Template literals in database query construction

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Missing magic bytes | MIME check only, no header verification | Add `verifyMagicBytes()` |
| Raw UUID | `const { lineId } = req.query; db.from('lines').select().eq('id', lineId)` | Validate with UUID_REGEX first |
| Direct comparison | `if (token === storedToken)` | Use `crypto.timingSafeEqual()` |
| No length cap | Accepting unbounded user text | Add `.max(N)` to Zod schema |
