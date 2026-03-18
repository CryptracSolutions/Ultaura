# Encryption Security Checks

## What to Look For

### 1. Never Inline Crypto
- **Pattern to flag**: Direct use of `crypto.createCipheriv()`, `crypto.createDecipheriv()`, or `crypto.createHash()` outside of the designated crypto files
- **Designated crypto files** (the ONLY files that should contain raw crypto operations):
  - `src/lib/ultaura/crypto-kek.ts` — KEK wrapping/unwrapping
  - `src/lib/ultaura/crypto-dek.ts` — DEK operations, encryption/decryption
  - `src/lib/ultaura/health/crypto.ts` — Health-specific encryption helpers
  - `src/lib/ultaura/health/document-crypto.ts` — File-level encryption for health documents
  - `src/lib/ultaura/health/hmac.ts` — HMAC subkey derivation
- **Correct pattern**: Import and use `encryptPayload()` / `decryptPayload()` from `crypto-dek.ts`, or `encryptHealthPayload()` / `decryptHealthPayload()` from `health/crypto.ts`

### 2. AAD (Additional Authenticated Data) Binding
- Every encryption call must include AAD that binds ciphertext to `account_id` + `line_id` + `type`
- **What this prevents**: Ciphertext transplant attacks (copying encrypted data from one account/line to another)
- **How to verify**: Check that encryption function calls pass the correct AAD parameters

### 3. IV Freshness
- Every encryption call must use a fresh random 12-byte IV: `crypto.randomBytes(12)`
- **Pattern to flag**: Reusing IVs, hardcoded IVs, or IVs derived from predictable data

### 4. Key Hierarchy
- **KEK** (Key Encryption Key): Loaded from `ULTAURA_ENCRYPTION_KEY` env var (64 hex chars = 256-bit)
- **Previous KEK**: `ULTAURA_ENCRYPTION_KEY_PREVIOUS` supports rotation — current tried first, then fallback
- **Account DEK**: One per account, stored in `ultaura_account_crypto_keys`
- **Line DEK**: One per line (newer lines), stored in `ultaura_line_crypto_keys`
- **Health data**: Uses line DEK ONLY — no account DEK fallback, no legacy line check
- **Pattern to flag**: Health code using account-level DEK, or skipping the `isLegacyLine()` check for non-health data

### 5. server-only Import
- **Every file** in `src/lib/ultaura/` must have `import 'server-only'` at the top
- **What this prevents**: Accidental inclusion of encryption logic in the client-side bundle, which would expose keys
- **How to verify**: `grep -rL "server-only" src/lib/ultaura/*.ts` to find files missing the import

### 6. Health Document Encryption
- Health documents (PDFs, images) must be encrypted at the buffer level before upload to Supabase Storage
- Stored as `.bin` objects with random UUID storage key (no guessable filenames)
- **Pattern to flag**: Uploading unencrypted files to storage, or using predictable storage keys

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Inline crypto | `const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)` in a service file | Use `encryptPayload()` from `crypto-dek.ts` |
| Missing AAD | `encryptPayload(data, dek)` without AAD parameter | Pass `{ accountId, lineId, type }` as AAD |
| Missing server-only | New file in `src/lib/ultaura/` without the import | Add `import 'server-only'` as first import |
| Health using account DEK | `getAccountDek(accountId)` in health code | Use `getLineDek(lineId)` via `health/crypto.ts` |
