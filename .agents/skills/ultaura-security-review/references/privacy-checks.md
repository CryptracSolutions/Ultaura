# Privacy Checks

## What to Look For

### 1. Existence Disclosure Prevention
- Sensitive routes (health, privacy, documents) must return `404 Not Found` for ALL error conditions:
  - Unauthorized access → 404 (not 403)
  - Wrong owner → 404 (not 403)
  - Resource not found → 404
- **Why**: Returning `403` reveals that the resource exists, which is PII leakage
- **Pattern to flag**: `403 Forbidden` responses on any health or privacy endpoint

### 2. Document Access Tokens
All document download/access flows must use short-lived tokens:
- **TTL**: 5 minutes maximum
- **Single-use**: Atomically consumed via `UPDATE ... WHERE used_at IS NULL`
- **Storage**: Token stored as SHA-256 hash only (never plaintext)
- **Rate limit**: 30 tokens per document per hour
- **Reference**: `src/lib/ultaura/health/document-tokens.ts`
- **Pattern to flag**: Long-lived tokens, reusable tokens, plaintext token storage

### 3. PII in Responses
- API responses must not include PII that the client doesn't need
- Check every `select` query: are you selecting only necessary columns?
- **Pattern to flag**: `select('*')` on tables with sensitive columns, returning encrypted data keys to the client

### 4. PII in Logs and Errors
- Error messages must not contain PII (names, phone numbers, health data)
- Log statements must not include decrypted data
- **Pattern to flag**: `console.log(userData)`, `throw new Error(`User ${name} failed`)`, Sentry breadcrumbs with PII

### 5. Redirect URL Validation
- All redirect URLs must be validated as `https:` before issuing
- **Pattern to flag**: Unvalidated redirect URLs (open redirect vulnerability)

### 6. Client-Side Data
- Decrypted sensitive data should only exist server-side
- Server Components can render decrypted data, but it must not be passed as props to Client Components that store it in state
- **Pattern to flag**: Decrypted data in React state, localStorage, sessionStorage, or URL params

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Existence disclosure | `return res.status(403)` on health endpoint | Use `404 Not Found` |
| Long-lived token | Token with 24-hour TTL | Reduce to 5-minute TTL |
| PII in logs | `logger.info('Processing user', { name, phone })` | Remove PII from log context |
| Overfetching | `.select('*')` on users table | Select only needed columns |
