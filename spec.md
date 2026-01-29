# Universal Search Bar - Implementation Spec

## 1. Objective & Scope

Implement a universal search bar in the dashboard header that enables users to:
- Navigate to any page in the dashboard
- Search and navigate to /docs documentation pages
- Search database entities (lines, reminders, schedules, contacts, calls, safety events)
- Access search via keyboard shortcut (Cmd+K / Ctrl+K)
- Use on mobile via floating button with bottom sheet UI

**UI Style**: Command palette (like Linear/Vercel) with persistent search input in header.

---

## 2. Non-Goals

- Full-text search within call transcripts or conversation content
- Search across memories (encrypted, admin-only access)
- Search marketing pages (only dashboard + docs)
- Fuzzy matching (will use simple substring matching initially)
- Search result ranking/relevance scoring (flat list, most recent first for DB entities)

---

## 3. Current State (Evidence)

### Header Structure
- **TopNavBar** (`/src/components/TopNavBar.tsx:21`): Desktop-only, `justify-end` layout with Quick Actions, Docs, Help, Feedback buttons
- Currently no search input exists
- Uses `sticky top-0 z-10` positioning

### Database Access
- **Supabase/PostgreSQL** with RLS via `can_access_ultaura_account()`
- Key tables: `ultaura_lines`, `ultaura_reminders`, `ultaura_schedules`, `ultaura_trusted_contacts`, `ultaura_call_sessions`, `ultaura_safety_events`
- **Reminder encryption**: AES-256-GCM, decrypted via `decryptReminderMessagesForLine()` in `/src/lib/ultaura/reminders.ts:69-107`

### Documentation
- MDX in `/src/content/docs/` processed by Contentlayer
- Existing local search in `/src/app/(site)/docs/components/DocsNavigation.tsx:138-157`
- 9 documentation sections with title/label fields

### Navigation Config
- `/src/navigation.config.tsx` defines all dashboard routes
- `createNavigationConfig()` function generates nav items by user type

### Mobile Patterns
- Dialog component (`/src/core/ui/Dialog.tsx:42-44`) uses bottom sheet on mobile (rounded-t-2xl)
- MobileAppNavigation (`/src/components/MobileAppNavigation.tsx`) has slide-out menu pattern

### Dependencies
- cmdk: **Not installed** (will need to add)
- Radix UI primitives: Available
- Heroicons: Available

---

## 4. Proposed Solution (High-Level)

1. **Install cmdk** as command palette foundation
2. **Create search API route** at `/api/search` for database queries
3. **Build SearchCommandPalette component** using cmdk + existing Dialog styling
4. **Integrate into TopNavBar** with search input on left, buttons on right
5. **Add mobile floating button** that triggers same command palette as bottom sheet
6. **Wire keyboard shortcut** (Cmd+K / Ctrl+K) globally
7. **Create SearchContext** to manage open/close state across components

---

## 5. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dashboard Layout                         │
├─────────────────────────────────────────────────────────────────┤
│  TopNavBar (Desktop)                                            │
│  ┌──────────────┐ ┌─────────────────────────────────────────┐  │
│  │ Search Input │ │ QuickActions | Docs | Help | Feedback   │  │
│  └──────────────┘ └─────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Mobile: Floating Search Button (bottom-right)                 │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SearchCommandPalette (Modal/BottomSheet)            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [🔍 Search input field...]                    ⌘K          │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  NAVIGATION                                               │  │
│  │    Home                                    → /dashboard   │  │
│  │    Lines                                   → /dashboard/lines │
│  │    Reminders                               → /dashboard/reminders │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  DOCUMENTATION                                            │  │
│  │    Getting Started                         → /docs/...    │  │
│  │    Managing Lines                          → /docs/...    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  LINES (from DB)                                          │  │
│  │    Mom's Line                              → /dashboard/lines/abc │
│  │    Dad's Line                              → /dashboard/lines/xyz │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  REMINDERS (from DB)                                      │  │
│  │    "Take medication" - Mom's Line          → /dashboard/lines/abc/reminders │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  SCHEDULES (from DB)                                      │  │
│  │    Daily 9:00 AM - Dad's Line              → /dashboard/lines/xyz/schedule │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼ (on database search)
┌─────────────────────────────────────────────────────────────────┐
│                    /api/search Route Handler                     │
│  - Accepts: query string                                         │
│  - Resolves org from cookie + session                            │
│  - Returns: normalized results by category                       │
│  - Decrypts reminder messages server-side                        │
│  - RLS enforced via Supabase session client                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Detailed Implementation Plan

### Phase 1: Foundation

#### Step 1.1: Install cmdk
```bash
pnpm add -w cmdk
```

**Files touched**: `package.json`, `pnpm-lock.yaml`

#### Step 1.2: Create SearchContext
Create context to manage search state globally.

**New file**: `/src/lib/contexts/SearchContext.tsx`
```typescript
// Exports: SearchProvider, useSearch (with open, close, toggle, isOpen)
// SearchProvider also renders <SearchCommandPalette /> once at the layout root
```

#### Step 1.3: Add SearchContext to Layout
**File**: `/src/app/dashboard/(app)/components/OrganizationScopeLayout.tsx`
- Add `<SearchProvider>` wrapping the layout so the palette is available globally

---

### Phase 2: Search API

#### Step 2.1: Create Search API Route
**New file**: `/src/app/api/search/route.ts`

**Functionality**:
- Accept `GET ?q=<query>`
- Authenticate user via Supabase session (no redirects; return 401 JSON on failure)
- Resolve current organization from cookie + membership (no client-supplied accountId)
  - `const { data: user } = await supabase.auth.getUser()`
  - `const organizationUid = await parseOrganizationIdCookie(user.id)`
  - `const { organization } = await getCurrentOrganization({ organizationUid, userId: user.id })`
  - `const account = await getUltauraAccount(organization.id)` → `accountId`
- Query multiple tables in parallel (RLS enforced via session client)
- Return normalized results with labels, subtitles, hrefs, timestamps
- Limit: 5 results per category
- Enforce `q` length: trim, clamp to 100 chars, return empty results when `q.length < 2`
- Disable caching (`export const dynamic = 'force-dynamic'`, `revalidate = 0`,
  `Cache-Control: no-store`)
- API returns only DB-backed categories; client merges navigation/docs into the same shape
  (navigation/documentation arrays can be returned as empty arrays for consistency)

**Response Shape**:
```ts
type SearchCategory =
  | 'navigation'
  | 'documentation'
  | 'lines'
  | 'reminders'
  | 'schedules'
  | 'contacts'
  | 'calls'
  | 'safety_events';

type SearchItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  category: SearchCategory;
  timestamp?: string; // ISO string for sorting in UI
};

type SearchResponse = {
  query: string;
  results: Record<SearchCategory, SearchItem[]>;
};
```

**Entity-specific matching (schema-correct)**:
- `ultaura_lines`: match `display_name`, `phone_e164`; order by `created_at desc`
- `ultaura_trusted_contacts`: match `name`, `phone_e164`; order by `created_at desc`
- `ultaura_reminders`: fetch recent reminders by `account_id` (limit 50), decrypt via
  `decryptReminderMessagesForLine`, then filter by message or line display name; order by
  `due_at desc` or `created_at desc`, then take top 5
- `ultaura_schedules`: fetch by `account_id`, build display string from
  `days_of_week`, `time_of_day`, `timezone`, filter by query; order by
  `next_run_at desc` or `created_at desc`, then take top 5
- `ultaura_call_sessions`: match `status`, `direction`, `twilio_from`, `twilio_to`;
  order by `created_at desc`
- `ultaura_safety_events`: match `tier`, `category`; order by `created_at desc`

**Join Strategy (for subtitles/links)**:
- For reminders, schedules, calls, safety events, and contacts, include line context by
  selecting `ultaura_lines(display_name, short_id)` in the query result to build
  subtitles and hrefs.

**Dependencies**:
- `/src/lib/ultaura/reminders.ts` (decryption logic)
- `/src/lib/ultaura/lines.ts`
- `/src/lib/server/cookies/organization.cookie.ts` (organization cookie)
- `/src/lib/server/organizations/get-current-organization.ts`
- `/src/lib/ultaura/accounts.ts` (`getUltauraAccount`)
- Supabase server client

---

### Phase 3: Command Palette Component

#### Step 3.1: Create SearchCommandPalette
**New file**: `/src/components/SearchCommandPalette.tsx`

**Structure**:
```tsx
<Dialog open={isOpen} onOpenChange={setOpen}>
  <DialogContent>
    <Command>
      <Command.Input placeholder="Search..." />
      <Command.List>
        <Command.Empty>No results found</Command.Empty>

        {/* Static navigation items */}
        <Command.Group heading="Navigation">
          <Command.Item>Home</Command.Item>
          <Command.Item>Lines</Command.Item>
          ...
        </Command.Group>

        {/* Documentation (from docs-index) */}
        <Command.Group heading="Documentation">
          {filteredDocs.map(doc => <Command.Item>...)}
        </Command.Group>

        {/* Dynamic database results */}
        {loading && <Command.Loading>Searching...</Command.Loading>}
        {results.lines.length > 0 && (
          <Command.Group heading="Lines">...</Command.Group>
        )}
        ...
      </Command.List>
    </Command>
  </DialogContent>
</Dialog>
```

**Styling**:
- Use existing Dialog pattern for mobile bottom sheet
- Match Ultaura design tokens (colors, fonts, spacing)
- Keyboard hint badge (⌘K) in input

**Behavior**:
- Disable cmdk fuzzy filtering (`shouldFilter={false}`) and apply simple substring
  matching for static items (navigation, docs)
- Database search debounced (300ms), triggered when query length >= 2
- Navigate on select, close palette
- Support keyboard navigation (up/down/enter/escape)

#### Step 3.2: Create Static Navigation Registry
**New file**: `/src/lib/search/navigation-registry.ts`

**Contents**:
- Dashboard navigation items with labels, paths, keywords
- Generated from `navigation.config.tsx` pattern
- Conditional items based on user type

#### Step 3.3: Create Documentation Index Loader
**New file**: `/src/lib/search/docs-index.ts`

**Contents**:
- Load `allDocumentationPages` from contentlayer and map to a minimal index
- Flatten tree for search
- Export as a searchable array **without** MDX body content (avoid bundling full docs)
- Shape example: `{ title, label, resolvedPath, section, keywords[] }`

---

### Phase 4: Integration

#### Step 4.1: Update TopNavBar
**File**: `/src/components/TopNavBar.tsx`

**Changes**:
- Add search input on the left side
- Change layout from `justify-end` to `justify-between`
- Search input opens command palette on focus
- Show keyboard shortcut hint

**Before**:
```tsx
<div className="hidden lg:flex items-center justify-end gap-2 ...">
  <QuickActionsDropdown />
  ...
</div>
```

**After**:
```tsx
<div className="hidden lg:flex items-center justify-between gap-2 ...">
  <SearchTrigger />
  <div className="flex items-center gap-2">
    <QuickActionsDropdown />
    ...
  </div>
</div>
```

#### Step 4.2: Create SearchTrigger Component
**New file**: `/src/components/SearchTrigger.tsx`

**Desktop**: Input-like button that opens command palette
**Styling**: Match existing input styles, include ⌘K badge

#### Step 4.3: Add Mobile Search Button
**File**: `/src/app/dashboard/(app)/components/OrganizationScopeLayout.tsx`

**Changes**:
- Add `SearchFloatingButton` rendered once at the layout root
- Use `fixed` positioning with `lg:hidden` (e.g., `bottom-4 right-4`)
- Opens same SearchCommandPalette (Dialog bottom sheet on mobile)

**New file**: `/src/components/SearchFloatingButton.tsx`

#### Step 4.4: Add Global Keyboard Shortcut
**File**: `/src/components/SearchCommandPalette.tsx` (or dedicated hook)

**Implementation**:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isEditable =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as HTMLElement).isContentEditable);
    if (isEditable) return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [toggle]);
```

---

### Phase 5: Polish

#### Step 5.1: Add Loading States
- Skeleton items during database fetch
- Smooth transitions

#### Step 5.2: Add Empty States
- "No results found" message
- Suggestions for common actions

#### Step 5.3: Add Result Icons
- Page icon for navigation
- Document icon for docs
- Phone icon for lines
- Bell icon for reminders
- Calendar icon for schedules
- User icon for contacts
- Shield icon for safety events

#### Step 5.4: Add Recent Searches (Optional Enhancement)
- Store last 5 searches in localStorage
- Show as suggestions when palette opens

---

## 7. Dependencies & Integrations

### New Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| cmdk | ^1.0.0 | Command palette foundation |

### Internal Integrations
- `navigation.config.tsx` - Source for navigation items
- `allDocumentationPages` - Contentlayer docs data
- `/src/lib/ultaura/*.ts` - Database queries
- `/src/lib/server/cookies/organization.cookie.ts` - Organization context
- `/src/lib/server/organizations/get-current-organization.ts` - Membership verification
- `/src/lib/ultaura/accounts.ts` - Account lookup
- `OrganizationScopeLayout` - Context provider + global palette + floating button

---

## 8. Configuration

### Environment Variables
No new environment variables required.

### Feature Flags
None required for initial implementation.

---

## 9. New Files Summary

| File Path | Purpose |
|-----------|---------|
| `/src/lib/contexts/SearchContext.tsx` | Search state management |
| `/src/app/api/search/route.ts` | Database search endpoint |
| `/src/components/SearchCommandPalette.tsx` | Main command palette component |
| `/src/components/SearchTrigger.tsx` | Desktop header search input |
| `/src/components/SearchFloatingButton.tsx` | Mobile floating search button |
| `/src/lib/search/navigation-registry.ts` | Static navigation items |
| `/src/lib/search/docs-index.ts` | Documentation index helper |

---

## 10. Modified Files Summary

| File Path | Changes |
|-----------|---------|
| `package.json` | Add cmdk dependency |
| `pnpm-lock.yaml` | Lockfile update for cmdk |
| `/src/app/dashboard/(app)/components/OrganizationScopeLayout.tsx` | Add SearchProvider + render palette + floating button |
| `/src/components/TopNavBar.tsx` | Add SearchTrigger, update layout |

---

## 11. Edge Cases & Failure Modes

| Scenario | Handling |
|----------|----------|
| API search fails | Show error toast, keep static results visible |
| Decryption fails | Use placeholder text `[Unable to decrypt]` (existing pattern) |
| No results | Show "No results found" with suggestion to try different query |
| User not authenticated | API returns 401; client keeps static results and prompts login |
| Slow network | Show loading skeleton, debounce queries |
| Very long query | Truncate at 100 chars on API side |
| Large result set | Limit to 5 per category, show "View all" link |
| Query length < 2 | Return empty result set from API |
| Cache leakage | Force `no-store` headers to avoid caching PII |

---

## 12. Security & Privacy Considerations

- **RLS enforced**: All database queries go through Supabase with user session, RLS policies apply
- **Server-side decryption**: Reminder messages decrypted only on server, never exposed in API response as ciphertext
- **No sensitive data in URLs**: Result items link to pages, not embed sensitive data in URL params
- **No caching of PII**: Force `dynamic` route and `Cache-Control: no-store` headers
- **Rate limiting**: Consider adding rate limiting for search API (future enhancement)

---

## 13. Observability

### Logging
- Log search queries (anonymized) with result counts
- Log decryption failures

### Metrics (Future)
- Search query latency
- Most common search terms
- Click-through rate on results

---

## 14. Testing Plan

### Unit Tests
- `navigation-registry.ts`: Verify item generation
- `docs-index.ts`: Verify flattening logic
- Search filtering logic

### Integration Tests
- API route: Valid query returns results
- API route: Empty query returns empty
- API route: Unauthorized returns 401
- API route: Decryption works for reminders
- API route: Query length < 2 returns empty result set

### E2E Tests (Cypress/Playwright)
- Open command palette with Cmd+K
- Type query, see results update
- Click result, navigate to page
- Mobile: Tap search button, bottom sheet opens
- Escape closes palette

### Manual Testing
1. Open dashboard, press Cmd+K → Palette opens
2. Type "remind" → See reminders matching
3. Click a reminder → Navigate to reminders page
4. On mobile, tap search icon → Bottom sheet opens
5. Search for a line by phone number → Find it

---

## 15. Rollout Plan

### Phase 1: Core Implementation
1. Install cmdk
2. Create SearchContext
3. Create API route
4. Create SearchCommandPalette with static items only
5. Integrate into TopNavBar (desktop)

### Phase 2: Database Search
1. Add database search to API
2. Wire up to command palette
3. Test decryption

### Phase 3: Mobile
1. Add floating button to mobile nav
2. Verify bottom sheet behavior

### Phase 4: Polish
1. Add icons, empty states
2. Performance optimization
3. Accessibility audit

**Backward Compatibility**: No breaking changes. New feature addition only.

---

## 16. Open Questions / Follow-ups

| Question | Status |
|----------|--------|
| Should we add search analytics to understand what users search for? | Future enhancement |
| Rate limiting for search API? | Future enhancement |
| Fuzzy matching with Fuse.js? | Future enhancement if substring matching insufficient |

---

## 17. Assumptions

1. Users have dashboard access (authenticated, organization member)
2. Organization UID cookie is present for dashboard sessions (set by layout)
3. Contentlayer documentation is built at deploy time (search index always current)
4. Database changes are reflected immediately (no separate search index needed)
5. cmdk works well with existing Radix primitives
6. 5 results per category is sufficient for initial implementation
