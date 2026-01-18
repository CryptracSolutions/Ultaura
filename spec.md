# Accessibility & Visual Consistency Fixes Specification

## Overview

This specification documents 27 accessibility and visual consistency issues across the Ultaura dashboard, with detailed implementation guidance for each fix. The fixes address WCAG 2.1 compliance gaps including missing accessible names, color-only information, form label associations, and visual consistency.

**Target Compliance:** WCAG 2.1 Level AA (with AAA for touch targets)

**Constraint:** Do NOT modify shared components in `/src/core/ui/` - only modify dashboard-specific files.

---

## Summary of Decisions

| Category | Decision |
|----------|----------|
| Icon-only buttons | Add `aria-label` attribute only (no sr-only spans) |
| Mood indicators | Add Lucide face-based icons alongside colored dots |
| Form labels | Add `id`/`htmlFor` association (keep existing layout) |
| Touch targets | Increase to 44x44px minimum |
| OrganizationsSelector | Verify Radix handles keyboard events (no changes unless broken) |
| DashboardUpcomingTabs | Keep as navigation, add `aria-current` |
| AlertBanner | Add `aria-live="polite"` |
| Severity badges | Add icons to all severities |
| Focus styles | Keep existing patterns |
| Spacing | Hierarchical: `p-6 rounded-xl` for main cards, `p-4 rounded-lg` for nested |
| Testing | Manual testing checklist |

---

## Implementation by File

### 1. AlertBanner.tsx

**File:** `/src/app/dashboard/(app)/lines/components/AlertBanner.tsx`

#### Issue 1.1: Dismiss button missing accessible name (WCAG 4.1.2)
**Lines:** 88-93

**Current:**
```tsx
<button
  onClick={() => setIsDismissed(true)}
  className="flex-shrink-0 p-1 rounded hover:bg-foreground/5 transition-colors"
>
  <X className="w-4 h-4 text-muted-foreground" />
</button>
```

**Fix:**
```tsx
<button
  onClick={() => setIsDismissed(true)}
  className="flex-shrink-0 p-1 rounded hover:bg-foreground/5 transition-colors"
  aria-label="Dismiss alert"
>
  <X className="w-4 h-4 text-muted-foreground" />
</button>
```

#### Issue 1.2: Missing live region for dynamic content (WCAG 4.1.3)

**Fix:** Add `aria-live="polite"` to the container div that conditionally renders the banner content.

```tsx
<div aria-live="polite">
  {/* banner content */}
</div>
```

---

### 2. ContactsClient.tsx

**File:** `/src/app/dashboard/(app)/lines/[lineId]/contacts/components/ContactsClient.tsx`

#### Issue 2.1: Delete button missing accessible name (WCAG 4.1.2)
**Lines:** 195-202

**Current:**
```tsx
<Button variant="ghost" size="icon" onClick={...} disabled={disabled}>
  <Trash2 className="h-4 w-4" />
</Button>
```

**Fix:**
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={...}
  disabled={disabled}
  aria-label={`Remove ${contact.name}`}
>
  <Trash2 className="h-4 w-4" />
</Button>
```

#### Issue 2.2: Form inputs without explicit labels (WCAG 1.3.1)
**Lines:** 125-143

**Current:**
```tsx
<Input
  placeholder="Name"
  value={newContact.name}
  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
  required
/>
<Input
  placeholder="Phone Number"
  type="tel"
  value={newContact.phone}
  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
  required
/>
<Input
  placeholder="Relationship (optional)"
  value={newContact.relationship}
  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
/>
```

**Fix:** Add visible labels with proper association:
```tsx
<div>
  <label htmlFor="contact-name" className="block text-sm font-medium text-foreground mb-1">
    Name
  </label>
  <Input
    id="contact-name"
    placeholder="e.g., John Smith"
    value={newContact.name}
    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
    required
  />
</div>
<div>
  <label htmlFor="contact-phone" className="block text-sm font-medium text-foreground mb-1">
    Phone Number
  </label>
  <Input
    id="contact-phone"
    placeholder="e.g., (555) 123-4567"
    type="tel"
    value={newContact.phone}
    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
    required
  />
</div>
<div>
  <label htmlFor="contact-relationship" className="block text-sm font-medium text-foreground mb-1">
    Relationship <span className="text-muted-foreground font-normal">(optional)</span>
  </label>
  <Input
    id="contact-relationship"
    placeholder="e.g., Son, Daughter, Caregiver"
    value={newContact.relationship}
    onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
  />
</div>
```

---

### 3. RemindersClient.tsx

**File:** `/src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx`

#### Issue 3.1: Edit button has title but no aria-label (WCAG 4.1.2)
**Lines:** 681-687

**Current:**
```tsx
<button
  onClick={() => openEditModal(reminder)}
  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
  title="Edit reminder"
>
  <Edit2 className="w-4 h-4" />
</button>
```

**Fix:**
```tsx
<button
  onClick={() => openEditModal(reminder)}
  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
  title="Edit reminder"
  aria-label="Edit reminder"
>
  <Edit2 className="w-4 h-4" />
</button>
```

#### Issue 3.2: Multiple icon-only buttons missing aria-label (WCAG 4.1.2)
**Lines:** 690-787

Add `aria-label` to each button matching its `title`:

| Button | aria-label |
|--------|------------|
| Pause | `aria-label="Pause reminder"` |
| Resume | `aria-label="Resume reminder"` |
| Snooze | `aria-label="Snooze reminder"` |
| Skip | `aria-label="Skip next occurrence"` |
| Cancel (recurring) | `aria-label="Cancel entire series"` |
| Cancel (one-time) | `aria-label="Cancel reminder"` |

#### Issue 3.3: Day of week buttons small touch targets (WCAG 2.5.5)
**Lines:** 517-535

**Current:**
```tsx
<button
  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${...}`}
>
  {day}
</button>
```

**Fix:**
```tsx
<button
  className={`min-w-[44px] min-h-[44px] px-3 py-2 rounded-full text-sm font-medium transition-colors ${...}`}
  aria-pressed={selectedDays.includes(i)}
>
  {day}
</button>
```

#### Issue 3.4: Checkbox label using wrapper pattern (WCAG 1.3.1 - Minor)
**Lines:** 472-477

The current wrapper pattern is acceptable but can be improved:

**Current (acceptable):**
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <Checkbox checked={isRecurring} onCheckedChange={...} />
  <span className="text-sm font-medium">Repeat this reminder</span>
</label>
```

**Improved (optional):**
```tsx
<div className="flex items-center gap-2">
  <Checkbox
    id="repeat-reminder"
    checked={isRecurring}
    onCheckedChange={...}
  />
  <label htmlFor="repeat-reminder" className="text-sm font-medium cursor-pointer">
    Repeat this reminder
  </label>
</div>
```

#### Issue 3.5: Textarea missing label association (WCAG 1.3.1)
**Lines:** 427-440 and 904-918

**Current:**
```tsx
<label className="block text-sm font-medium text-foreground mb-2">
  Reminder Message
</label>
<textarea
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  ...
/>
```

**Fix:**
```tsx
<label htmlFor="reminder-message" className="block text-sm font-medium text-foreground mb-2">
  Reminder Message
</label>
<textarea
  id="reminder-message"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  ...
/>
```

Apply same fix to edit modal textarea (lines 904-918) with `id="edit-reminder-message"`.

---

### 4. InvitedFamilyList.tsx

**File:** `/src/app/dashboard/(app)/privacy/components/InvitedFamilyList.tsx`

#### Issue 4.1: Delete button missing accessible name (WCAG 4.1.2)
**Lines:** 57-64

**Current:**
```tsx
<Button variant="ghost" size="sm" onClick={() => onRemove(recipient.id)}>
  <Trash2 className="h-4 w-4" />
</Button>
```

**Fix:**
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => onRemove(recipient.id)}
  aria-label={`Remove ${recipient.name}`}
>
  <Trash2 className="h-4 w-4" />
</Button>
```

---

### 5. OrganizationsSelector.tsx

**File:** `/src/app/dashboard/(app)/components/organizations/OrganizationsSelector.tsx`

#### Issue 5.1: Interactive div potentially missing keyboard support (WCAG 2.1.1)
**Lines:** 77-102

**Action:** Verify that Radix UI's `SelectTrigger` with `asChild` properly forwards keyboard events to the child div.

**Verification Steps:**
1. Open the dashboard in a browser
2. Tab to the organization selector
3. Verify the div receives focus (should have visible focus ring)
4. Press Enter or Space - dropdown should open
5. Arrow keys should navigate options
6. Enter should select, Escape should close

**If verification fails:** Add explicit keyboard handling:
```tsx
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Trigger the select open
    }
  }}
  ...
>
```

---

### 6. VerifyPhoneClient.tsx

**File:** `/src/app/dashboard/(app)/lines/[lineId]/verify/components/VerifyPhoneClient.tsx`

#### Issue 6.1: Back button is button used as navigation (WCAG 2.1.1)
**Lines:** 159-165

**Current:**
```tsx
<button onClick={() => setStep('choose')} className="...">
  <ArrowLeft className="w-4 h-4" />Back
</button>
```

**Fix:**
```tsx
<button
  onClick={() => setStep('choose')}
  className="..."
  aria-label="Go back to channel selection"
>
  <ArrowLeft className="w-4 h-4" />
  <span>Back</span>
</button>
```

#### Issue 6.2: Verification code inputs missing labels (WCAG 1.3.1)
**Lines:** 181-196

**Current:**
```tsx
{code.map((digit, index) => (
  <input
    key={index}
    type="text"
    inputMode="numeric"
    maxLength={1}
    ...
  />
))}
```

**Fix:**
```tsx
{code.map((digit, index) => (
  <input
    key={index}
    type="text"
    inputMode="numeric"
    maxLength={1}
    aria-label={`Digit ${index + 1} of 6`}
    ...
  />
))}
```

---

### 7. MilestonesClient.tsx

**File:** `/src/app/dashboard/(app)/lines/[lineId]/milestones/components/MilestonesClient.tsx`

#### Issue 7.1: Form inputs with adjacent labels but no association (WCAG 1.3.1)
**Lines:** 194-202, 261-270, and other form fields

**Current pattern:**
```tsx
<label className="text-xs text-muted-foreground block mb-1">Title</label>
<Input value={formState.title} ... />
```

**Fix pattern:**
```tsx
<label htmlFor="milestone-title" className="text-xs text-muted-foreground block mb-1">
  Title
</label>
<Input
  id="milestone-title"
  value={formState.title}
  ...
/>
```

**Apply to all form fields:**
| Field | id |
|-------|-----|
| Title | `milestone-title` |
| Type | `milestone-type` |
| Related person | `milestone-person` |
| Month | `milestone-month` |
| Day | `milestone-day` |
| Year | `milestone-year` |

#### Issue 7.2: Switch without explicit label association (WCAG 1.3.1)
**Lines:** 300-305

**Current:**
```tsx
<Switch checked={formState.isRecurring} ... />
{/* Adjacent text exists but not associated */}
```

**Fix:**
```tsx
<div className="flex items-center gap-2">
  <Switch
    id="milestone-recurring"
    checked={formState.isRecurring}
    ...
  />
  <label htmlFor="milestone-recurring" className="text-sm cursor-pointer">
    Repeat every year
  </label>
</div>
```

---

### 8. MoodTrend.tsx

**File:** `/src/app/dashboard/(app)/insights/components/MoodTrend.tsx`

#### Issue 8.1: Color-only mood indicators (WCAG 1.4.1)
**Lines:** 55-60

**Current:**
```tsx
{dots.map((mood, index) => (
  <span
    key={`${date}-${index}`}
    className={`h-2 w-2 rounded-full ${MOOD_COLORS[mood]}`}
    title={`Mood: ${MOOD_LABELS[mood]}`}
  />
))}
```

**Fix:** Add Lucide icons alongside dots:

```tsx
import { Smile, Meh, Frown } from 'lucide-react';

const MOOD_ICONS: Record<InsightMood, React.ElementType> = {
  positive: Smile,
  neutral: Meh,
  low: Frown,
};

// In render:
{dots.map((mood, index) => {
  const Icon = MOOD_ICONS[mood];
  return (
    <span
      key={`${date}-${index}`}
      className={`inline-flex items-center ${MOOD_COLORS[mood]}`}
      title={`Mood: ${MOOD_LABELS[mood]}`}
      aria-label={MOOD_LABELS[mood]}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
    </span>
  );
})}
```

---

### 9. MoodCalendar.tsx

**File:** `/src/app/dashboard/(app)/lines/[lineId]/insights/MoodCalendar.tsx`

#### Issue 9.1: Color-only mood indicators (WCAG 1.4.1)
**Lines:** 71-73, 80-87 (legend)

**Fix:** Same pattern as MoodTrend - add Lucide face icons.

For the extended mood set (6 moods), use:
```tsx
import { Smile, Meh, Frown, AlertCircle, CloudRain, Flame } from 'lucide-react';

const MOOD_ICONS: Record<MoodSnapshotMood, React.ElementType> = {
  positive: Smile,
  neutral: Meh,
  low: Frown,
  anxious: AlertCircle,
  sad: CloudRain,
  frustrated: Flame,
};
```

Update both the calendar cells and the legend to show icons alongside colored indicators.

---

### 10. EmotionalTrends.tsx

**File:** `/src/app/dashboard/(app)/lines/[lineId]/insights/EmotionalTrends.tsx`

#### Issue 10.1: Color-only mood dots (WCAG 1.4.1)
**Lines:** 67-73

**Fix:** Same pattern as MoodCalendar - add the 6-mood icon mapping.

---

### 11. WellnessAlertsList.tsx

**File:** `/src/app/dashboard/(app)/alerts/WellnessAlertsList.tsx`

#### Issue 11.1: Color-only severity indication in badges (WCAG 1.4.1)
**Lines:** 98-102

**Current:**
```tsx
<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_STYLES[alert.severity]}`}>
  {alert.severity}
</span>
```

**Fix:** Add icons to severity badges:
```tsx
import { Info, AlertTriangle, AlertCircle } from 'lucide-react';

const SEVERITY_ICONS: Record<WellnessAlert['severity'], React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  urgent: AlertCircle,
};

// In render:
{(() => {
  const Icon = SEVERITY_ICONS[alert.severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_STYLES[alert.severity]}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {alert.severity}
    </span>
  );
})()}
```

#### Issue 11.2: Select component needs label (WCAG 1.3.1)
**Lines:** 66-79

**Fix:** Add aria-label to the Select:
```tsx
<Select value={selectedLineId} onValueChange={setSelectedLineId}>
  <SelectTrigger className="w-[180px]" aria-label="Filter by line">
    <SelectValue placeholder="All lines" />
  </SelectTrigger>
  ...
</Select>
```

---

### 12. DashboardUpcomingTabs.tsx

**File:** `/src/app/dashboard/(app)/components/DashboardUpcomingTabs.tsx`

#### Issue 12.1: Tab panel lacks ARIA attributes (WCAG 4.1.2)

Since this component uses URL-based navigation (not JavaScript tabs), treat as navigation links:

**Fix:** Add `aria-current` to the active navigation item:

```tsx
<NavigationItem
  key={tab.value}
  className={'flex-1 lg:flex-none'}
  active={tab.value === activeTab}
  aria-current={tab.value === activeTab ? 'page' : undefined}
  scroll={false}
  link={{ path: tab.path, label: tab.label }}
/>
```

**Note:** This requires the `NavigationItem` component to forward the `aria-current` prop. If `NavigationItem` is in `/core/ui/` (which we're avoiding modifying), instead wrap it:

```tsx
<div aria-current={tab.value === activeTab ? 'page' : undefined}>
  <NavigationItem ... />
</div>
```

---

### 13. UpdateProfileForm.tsx

**File:** Location TBD - search for `UpdateProfileForm`

#### Issue 13.1: ImageUploader may lack alt text handling (WCAG 1.1.1)

**Action:** Verify that uploaded profile images have meaningful alt text.

**Expected behavior:**
- If the image is decorative (avatar), use `alt=""` with `role="presentation"`
- If the image conveys meaning, use descriptive alt text like `alt={`${user.name}'s profile photo`}`

---

### 14. TopicsChart.tsx

**File:** `/src/app/dashboard/(app)/insights/components/TopicsChart.tsx`

#### Issue 14.1: Potentially low contrast on topic badges (WCAG 1.4.3)
**Lines:** 16-23

**Action:** Verify contrast ratio of `text-primary` on `bg-primary/10`.

**Verification:**
1. Use browser dev tools color picker to get the computed colors
2. Use a contrast checker (WebAIM, Colour Contrast Analyser)
3. Confirm ratio is at least 4.5:1 for normal text

**Document findings:**
- If passes: No change needed
- If fails: Change to `text-foreground` on `bg-primary/10`

---

## Spacing Standardization

### Standard Patterns

Adopt hierarchical spacing throughout dashboard:

| Level | Pattern | Usage |
|-------|---------|-------|
| Main cards | `p-6 rounded-xl border border-border bg-card` | Top-level dashboard cards |
| Nested containers | `p-4 rounded-lg border border-border/60 bg-muted/20` | Items inside cards |
| Compact items | `p-3 rounded-lg` | Smallest nested elements |

### Files to Audit

Review and standardize spacing in:
- `/src/app/dashboard/(app)/insights/components/*.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/insights/*.tsx`
- `/src/app/dashboard/(app)/alerts/*.tsx`

Ensure:
1. All main insight cards use `p-6 rounded-xl`
2. All nested items within cards use `p-4 rounded-lg`
3. Border opacity follows hierarchy: `border-border` for main, `border-border/60` for nested

---

## Manual Testing Checklist

After implementing all fixes, verify each with these tests:

### Keyboard Navigation Testing
- [ ] Tab through all interactive elements in order
- [ ] Each focusable element has visible focus indicator
- [ ] Enter/Space activates buttons and controls
- [ ] Escape closes modals and dropdowns
- [ ] Day-of-week buttons announce selection state

### Screen Reader Testing (VoiceOver/NVDA)
- [ ] Icon-only buttons announce their purpose ("Dismiss alert", "Remove John Smith", etc.)
- [ ] Form inputs announce their labels when focused
- [ ] Mood indicators announce mood name (not just color)
- [ ] Severity badges announce icon meaning via text
- [ ] AlertBanner announces when it appears
- [ ] Verification code inputs announce "Digit 1 of 6" etc.

### Color Independence Testing
- [ ] View mood indicators in grayscale (browser extension or OS setting)
- [ ] Confirm icons differentiate moods without color
- [ ] Verify severity badges are distinguishable without color
- [ ] Check topic badge contrast with color contrast tool

### Touch Target Testing
- [ ] Day-of-week buttons are at least 44x44px
- [ ] Use browser dev tools to measure element dimensions
- [ ] Test on mobile device or emulator

### Form Label Testing
- [ ] Click on each form label - cursor should focus the associated input
- [ ] Screen reader announces label when input is focused

---

## Implementation Order (Recommended)

1. **Quick wins** (aria-label additions):
   - AlertBanner.tsx
   - ContactsClient.tsx (delete button)
   - RemindersClient.tsx (all icon buttons)
   - InvitedFamilyList.tsx
   - VerifyPhoneClient.tsx (back button, code inputs)

2. **Form label associations**:
   - ContactsClient.tsx (form inputs)
   - MilestonesClient.tsx
   - RemindersClient.tsx (textarea)
   - WellnessAlertsList.tsx (select)

3. **Mood indicator icons**:
   - Create shared MOOD_ICONS constant
   - MoodTrend.tsx
   - MoodCalendar.tsx
   - EmotionalTrends.tsx

4. **Severity badge icons**:
   - WellnessAlertsList.tsx

5. **Touch targets**:
   - RemindersClient.tsx (day buttons)

6. **Live regions**:
   - AlertBanner.tsx

7. **Verification tasks**:
   - OrganizationsSelector.tsx (keyboard test)
   - TopicsChart.tsx (contrast check)
   - UpdateProfileForm.tsx (alt text audit)

8. **Spacing standardization**:
   - Audit and fix spacing patterns

---

## Files Modified Summary

| File | Changes |
|------|---------|
| AlertBanner.tsx | aria-label, aria-live |
| ContactsClient.tsx | aria-label, form labels |
| RemindersClient.tsx | aria-label (6 buttons), form labels, touch targets |
| InvitedFamilyList.tsx | aria-label |
| VerifyPhoneClient.tsx | aria-label (7 inputs) |
| MilestonesClient.tsx | form labels (6+ fields) |
| MoodTrend.tsx | add icons |
| MoodCalendar.tsx | add icons |
| EmotionalTrends.tsx | add icons |
| WellnessAlertsList.tsx | icons, aria-label |
| DashboardUpcomingTabs.tsx | aria-current |
| Various insight components | spacing standardization |

---

## WCAG Success Criteria Addressed

| Criterion | Description | Issues Fixed |
|-----------|-------------|--------------|
| 1.1.1 | Non-text Content | Image alt text verification |
| 1.3.1 | Info and Relationships | Form label associations (12 inputs) |
| 1.4.1 | Use of Color | Mood icons, severity icons |
| 1.4.3 | Contrast | Topic badge verification |
| 2.1.1 | Keyboard | Button aria-labels, keyboard handler verification |
| 2.4.7 | Focus Visible | Existing patterns maintained |
| 2.5.5 | Target Size | Day buttons increased to 44px |
| 4.1.2 | Name, Role, Value | Icon button aria-labels (15+ buttons) |
| 4.1.3 | Status Messages | AlertBanner aria-live |


## Responses to Questions
  1. Target Files for Contacts and Verify

  Answer: The correct paths are:
  - /src/app/dashboard/(app)/lines/[lineId]/contacts/ContactsClient.tsx
  - /src/app/dashboard/(app)/lines/[lineId]/verify/VerifyPhoneClient.tsx

  The spec incorrectly showed a /components/ subdirectory. Apply fixes to these actual file paths.

  ---
  2. DashboardUpcomingTabs - NavigationItem and aria-current

  Answer: Skip this fix entirely.

  Rationale:
  - NavigationItem does NOT forward aria-current and the rest props aren't spread to the Link
  - Wrapping in a div breaks ul > li semantics (invalid HTML)
  - Reimplementing locally creates maintenance burden
  - Modifying core violates the stated constraint

  Why it's acceptable to skip: This component uses URL-based navigation (?tab=calls / ?tab=reminders). Screen readers already announce page changes via the URL/document title. The active prop visually indicates the current tab. This is a nice-to-have, not a critical accessibility failure. If you want to address it later, do so in a separate PR that allows core changes.

  ---
  3. Mood Indicators - Icons vs Dots, Coloring

  Answer: Icons should replace the dots, and icons should be colored with mood colors.

  Rationale:
  - Replacing (not adding alongside) keeps the UI clean and compact - the dots are very small (2x2px), so adding icons next to them would look cluttered
  - Colored icons maintain the existing visual language while adding shape differentiation
  - The color provides quick recognition for sighted users; the shape provides differentiation for colorblind users
  - Icons inherit the semantic meaning of colors (green smile = positive, red frown = low)

  Implementation:
  const Icon = MOOD_ICONS[mood];
  return (
    <Icon 
      className={`h-3 w-3 ${MOOD_COLORS[mood]}`} 
      aria-hidden="true" 
    />
  );

  ---
  4. RemindersClient - Checkbox Label Association

  Answer: Leave the wrapper pattern unchanged.

  Rationale:
  - The current pattern (<label><Checkbox /><span>text</span></label>) is valid HTML and accessible
  - When a form control is nested inside a <label>, implicit association occurs per HTML spec
  - This pattern is used consistently in the file (lines 472-477 and 557-563)
  - Changing to explicit id/htmlFor adds code without meaningful accessibility improvement
  - Minimizing changes reduces regression risk

  ---
  5. UpdateProfileForm - ImageUploader Alt Text

  Answer: Treat the avatar as decorative. No change needed.

  Rationale:
  - In the profile settings context, the avatar is decorative:
    - The user's display name is shown separately in a text field
    - The heading "Profile Picture" with subheading already describes the image's purpose
    - The user is viewing their own image that they uploaded
  - Empty alt="" is correct for decorative images per WCAG
  - Changing ImageUploader would require modifying /core/ui/ (violates constraint)
  - If avatars are used elsewhere to identify different users (e.g., comments, team lists), that would be a separate concern requiring a different approach

  ---
  6. OrganizationsSelector - Keyboard Behavior Verification

  I cannot run browser tests, but based on Radix UI documentation, SelectTrigger with asChild should forward keyboard events to the child element. The component pattern looks correct.

  Recommended verification steps:
  1. Tab to the organization selector - should receive visible focus
  2. Press Enter or Space - dropdown should open
  3. Arrow keys should navigate options
  4. Enter should select, Escape should close

  If it fails: Add explicit keyboard handling since we can't modify the core component. The fix would add tabIndex={0} and onKeyDown to the div.

  ---
  7. TopicsChart Contrast

  Answer: The contrast likely FAILS 4.5:1. Switching to text-foreground is acceptable.

  Analysis:
  - --primary: oklch(0.696 0.119 180.426) ≈ teal with 69.6% lightness
  - bg-primary/10 on #f8f8f7: very light teal wash ≈ #f4f7f7
  - Estimated contrast ratio: 2.5:1 to 3.2:1 (fails 4.5:1 requirement)
  - --foreground: oklch(0.147 0.004 49.25) - very dark, will easily exceed 4.5:1

  Fix:
  // Before
  className="... text-primary"
  // After
  className="... text-foreground"

  ---
  8. Spacing Standardization Scope

  Answer: Standardize only generic nested cards. Keep special styling for semantic callouts and empty states.

  Standardize to p-4 rounded-lg border-border/60 bg-muted/20:
  - Nested list item cards (currently inconsistent: some use border-border/70, others border-border/60)
  - General info cards within main containers

  Keep special styling (do NOT standardize):
  - Warning callouts: border-warning/30 bg-warning/10 - semantic for warnings
  - Urgent/destructive alerts: border-destructive/20 bg-destructive/5 - semantic for urgency
  - Dashed empty states: border-dashed border-border - visual pattern for "nothing here yet"
  - Calendar empty cells: border-dashed border-border/60 - placeholder pattern for grid

  Specific fix: Change border-border/70 to border-border/60 in WellnessAlertsList.tsx (line 93) for consistency with other nested items.