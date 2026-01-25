# Modal Conversion Specification

## Objective

Convert inline forms and controls across the Ultaura dashboard into modal-based interactions, creating a consistent "read-only by default, editing is explicit" user experience. This specification covers surgical, incremental changes that follow established codebase patterns.

---

## Scope Summary

| Priority | Component | Conversion Type |
|----------|-----------|-----------------|
| 1 | ScheduleClient.tsx | Inline create form → Modal |
| 2 | RemindersClient.tsx | Inline create form → Modal |
| 3 | RemindersPageClient.tsx | Button-per-line → Single modal with line picker (reuses CreateReminderForm) |
| 4 | CallsPageClient.tsx | Button-per-line → Single modal with line picker (reuses CreateScheduleForm) |
| 5 | DebugLogFilters.tsx | Inline filter panel → Filters modal (Admin, form method="GET" preserved) |

**Out of Scope:** WellnessAlertsList.tsx and InsightsPageClient.tsx (single-filter UIs don't benefit from modals).

---

## Global Patterns & Conventions

### Modal Structure (Match “New exception” Modal 1:1)

All new modals introduced by this spec must match the existing **“New exception”** modal in:
- Close button styling (the `X` icon button in the top-right)
- Title + description layout
- Button labels and placements (left “Discard changes”, right “Save …”)
- Field styling (e.g., `h-11` for Select triggers, input classes)
- Error block styling

**Scrolling requirement (exception-compatible):**
- Keep the overall visual/layout identical, but allow content to scroll when it exceeds the viewport.
- Use a constrained height on the dialog content and make the *form body* scroll while keeping header and footer visible.

Reference implementation (must copy structure/behavior):  
`src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx` → “New exception” modal.

```tsx
<Dialog open={isOpen} onOpenChange={handleOpenChange}>
  <DialogContent
    className="max-w-[468px] flex flex-col max-h-[85vh]"
    overlayClassName="bg-black/50 backdrop-blur-none"
  >
    {/* Header */}
    <div className="flex items-start justify-between gap-4 flex-shrink-0">
      <div className="min-w-0">
        <DialogTitle className="truncate">{title}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {description}
        </DialogDescription>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Close"
        disabled={isSubmitting}
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Error */}
    {error && (
      <div
        role="alert"
        className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive flex-shrink-0"
      >
        {error}
      </div>
    )}

    {/* Form (scrollable body + fixed footer) */}
    <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
        {/* form fields */}
      </div>

      <div className="flex gap-3 pt-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleDiscard}
          className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
          disabled={isSubmitting}
        >
          Discard changes
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </>
          ) : (
            saveLabel
          )}
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

**Layout Requirements:**
- `DialogContent` must use `max-w-[468px] flex flex-col max-h-[85vh]`
- The `<form>` should be `flex flex-col min-h-0 flex-1` so the body can scroll
- The fields container uses `flex-1 overflow-y-auto min-h-0`
- The footer buttons match the “New exception” button styles and placement

### Close / Discard Behavior (Match “New exception”)

The “New exception” modal does **not** use a close-guard confirmation. To match 1:1:

1. **X button** closes immediately by calling the same handler as “Discard changes”.
2. **Click outside / Escape** closes the dialog and discards local modal state (Radix default), except while submitting.
3. **Submitting state** disables the X button and prevents double-submit.
4. **Explicit discard** is provided by the left footer button labeled exactly “Discard changes”.

**Multi-step exception (allowed):** For 2-step overview modals (line picker → form), Step 2 includes a “Back” control. If the form is dirty and the user clicks “Back”, show a discard confirmation (“Discard changes?” / “Going back will discard your … details.”). All buttons still use the same visual styles as “New exception”.

### Save Behavior

- **Immediate save**: Each modal saves its own data on submit
- **On success**: `toast.success()` + close modal + `router.refresh()`
- **On error**: Inline error block (styled like “New exception”; include `role="alert"`) + modal stays open
- **During submit**: Disable all close methods and submit button, show spinner

### Accessibility Requirements

1. `aria-label="Close"` on X button
2. `DialogTitle` + `DialogDescription` for screen reader labeling
3. Focus first input on open via `onOpenAutoFocus`:
   ```tsx
   onOpenAutoFocus={(e) => {
     e.preventDefault();
     firstInputRef.current?.focus();
   }}
   ```
4. Natural tab order (Radix handles focus trap)
5. Enter submits form; Escape closes the modal (Radix default)

### Key Files to Reference

| Purpose | Path |
|---------|------|
| Dialog components | `src/core/ui/Dialog.tsx` |
| ConfirmationDialog | `src/core/ui/ConfirmationDialog.tsx` |
| Button classes | `src/core/ui/modal-button-classes.ts` |
| Leave page guard hook | `src/core/hooks/use-leave-page-guard.ts` |
| Example multi-step modal | `src/app/dashboard/(app)/lines/components/AddLineModal.tsx` |
| Example edit modal | `src/app/dashboard/(app)/lines/[lineId]/milestones/MilestonesClient.tsx` |
| Day normalization utility | `src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx` (see `normalizeDays`) |
| Schedule schema | `packages/schemas/src/schedule.ts` |
| Line update schema | `packages/schemas/src/line.ts` (see `UpdateLineInputSchema`) |
| Vacation actions | `src/lib/ultaura/vacation.ts` |
| “New exception” modal | `src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx` |

---

## Line Data Types

### LineRow Fields (from database.types.ts)

Key fields used throughout the modal conversions. **Note:** LineRow uses snake_case (database column names). When passing to UI components or form props, use camelCase equivalents.

| LineRow Field (snake_case) | UI Prop (camelCase) | Type | Usage |
|---------------------------|---------------------|------|-------|
| `id` | `id` | `string` (UUID) | Primary identifier |
| `account_id` | `accountId` | `string` (UUID) | Required for `createSchedule` |
| `display_name` | `displayName` | `string` | Shown in UI |
| `phone_e164` | `phoneE164` | `string` | Phone number (E.164 format) |
| `timezone` | `timezone` | `string` | IANA timezone, required for schedules/reminders |
| `quiet_hours_start` | `quietHoursStart` | `string` | HH:mm format |
| `quiet_hours_end` | `quietHoursEnd` | `string` | HH:mm format |
| `short_id` | `shortId` | `string` | URL-friendly identifier |

**Important:** Use `phoneE164` (not `phoneNumber`) when displaying phone numbers.

---

## Conversion 1: ScheduleClient Create Modal

**File:** `src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx`

### Current UX
- "New Schedule" button shows inline expanded form within the page
- Form contains: day selection (7 buttons), time dropdown, 3 quick presets
- Discard/Create buttons at bottom of inline form

### Target UX
- "New Schedule" button opens a modal
- Modal contains same form fields in scrollable body
- Quick presets remain as clickable cards
- Footer buttons match “New exception” 1:1:
  - Left: **“Discard changes”**
  - Right: **“Save Schedule”**

### Trigger Placement
- Replace current "New Schedule" button behavior
- Button location unchanged (same position on page)
- Empty state CTA also opens modal

### Form State Strategy
- Keep existing state variables: `selectedDays`, `selectedTime`
- Add `showCreateModal` boolean (rename from `showCreate`)
- `hasChanges` = days/time differ from defaults (weekdays 9:00 AM)
- Reset state when modal opens: `setSelectedDays([1,2,3,4,5])`, `setSelectedTime('09:00')`

### Implementation Details

**Important:** Use the existing `normalizeDays` function for day comparison to avoid state mutation bugs.

```tsx
// Use existing normalizeDays utility (already in file)
// Returns a comma-joined string for easy comparison
// const normalizeDays = (days: number[]) => days.slice().sort((a, b) => a - b).join(',');

// State
const [showCreateModal, setShowCreateModal] = useState(false);
const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
const [selectedTime, setSelectedTime] = useState('09:00');

// Change detection - compare normalized strings directly
const DEFAULT_DAYS = [1, 2, 3, 4, 5];
const DEFAULT_TIME = '09:00';
const hasChanges = useMemo(() => {
  const daysChanged = normalizeDays(selectedDays) !== normalizeDays(DEFAULT_DAYS);
  const timeChanged = selectedTime !== DEFAULT_TIME;
  return daysChanged || timeChanged;
}, [selectedDays, selectedTime]);

// Open handler
const openCreateModal = () => {
  setSelectedDays([1, 2, 3, 4, 5]);
  setSelectedTime('09:00');
  setError(null);
  setShowCreateModal(true);
};

// Submit (existing createSchedule logic)
const handleCreateSubmit = async (e: FormEvent) => {
  e.preventDefault();
  if (selectedDays.length === 0) {
    setError('Please select at least one day');
    return;
  }
  setIsLoading(true);
  setError(null);
  // ... existing server action call ...
  toast.success('Schedule created');
  setShowCreateModal(false);
  router.refresh();
};
```

### Modal Content Structure
1. **Header**: "Create Schedule" / "Set up when calls should happen"
2. **Body** (scrollable):
   - Day selection buttons (Mon-Sun toggle grid)
   - Time dropdown (existing TIME_OPTIONS)
   - Quick presets section with 3 cards
   - Schedule summary preview
3. **Footer**: Discard changes / Save Schedule

### Validation
- At least one day must be selected
- Time is always valid (dropdown)

### Post-Success
- `toast.success('Schedule created')`
- Close modal
- `router.refresh()`

### Reusable Form Component Extraction

Extract the schedule creation form fields (not the dialog wrapper) into a reusable component:

**File:** `src/components/ultaura/CreateScheduleForm.tsx`

This is a **form component** (not a Radix Dialog itself). It renders the form fields and can be embedded inside different dialog wrappers.

```tsx
interface CreateScheduleFormProps {
  // Line context (from LineRow)
  lineId: string;
  accountId: string;
  lineName: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Existing schedules for validation/display
  existingSchedules: ScheduleRow[];

  // Form state callbacks
  onSuccess: () => void;
  onHasChangesChange?: (hasChanges: boolean) => void;
}

export function CreateScheduleForm({
  lineId,
  accountId,
  lineName,
  timezone,
  quietHoursStart,
  quietHoursEnd,
  existingSchedules,
  onSuccess,
  onHasChangesChange,
}: CreateScheduleFormProps) {
  // Form state and logic here
  // Calls onHasChangesChange when dirty state changes (for parent modal)
  // Calls onSuccess after successful save
}
```

**Why these props:**
- `accountId`: Required by `createSchedule(accountId, input)` server action
- `timezone`: Required by `CreateScheduleInputSchema` and for time display
- `quietHoursStart/End`: For quiet hours conflict validation/warning
- `onHasChangesChange`: Parent modal needs to know dirty state for close guard

### Testing Checklist
- [ ] Open modal from "New Schedule" button
- [ ] Open modal from empty state CTA
- [ ] Day selection toggles work
- [ ] Time dropdown works
- [ ] Quick presets auto-fill form
- [ ] Schedule summary updates live
- [ ] Validation error shows when no days selected
- [ ] Submit shows loading spinner
- [ ] Submit disabled during loading
- [ ] Close disabled during loading
- [ ] Success closes modal and refreshes list
- [ ] Error shows inline banner, modal stays open
- [ ] Dirty close shows confirmation dialog
- [ ] Clean close (no changes) closes immediately
- [ ] Escape key follows dirty guard
- [ ] Click outside follows dirty guard

---

## Conversion 2: RemindersClient Create Modal

**File:** `src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx`

### Current UX
- "New Reminder" button shows inline expanded form
- Form contains: message textarea, date picker, time picker, recurrence options (toggle + frequency + days + end date)
- Form can get tall with recurrence options expanded

### Target UX
- "New Reminder" button opens a modal
- Modal matches the “New exception” modal 1:1 in structure and button styling
- Content scroll enabled (form body scrolls; header/footer fixed)
- Recurrence options stay as an optional section (checkbox to enable)
- Footer buttons: “Discard changes” (left) and “Save Reminder” (right)

### Trigger Placement
- Replace current "New Reminder" button behavior
- Button location unchanged
- Empty state CTA also opens modal

### Form State Strategy
- Keep all existing state: `message`, `date`, `time`, `isRecurring`, `frequency`, `interval`, `selectedDays`, `dayOfMonth`, `hasEndDate`, `endDate`
- Add `showCreateModal` boolean (rename from `showForm`)
- Reset all state when modal opens

### Implementation Details

```tsx
// Reset function
const resetCreateForm = () => {
  setMessage('');
  setDate('');
  setTime('09:00');
  setIsRecurring(false);
  setFrequency('daily');
  setInterval(1);
  setSelectedDays([]);
  setDayOfMonth(1);
  setHasEndDate(false);
  setEndDate('');
  setError(null);
};

// Change detection
const hasChanges = useMemo(() => {
  return message.trim() !== '' ||
    date !== '' ||
    time !== '09:00' ||
    isRecurring ||
    hasEndDate;
}, [message, date, time, isRecurring, hasEndDate]);

// Open handler
const openCreateModal = () => {
  resetCreateForm();
  setShowCreateModal(true);
};
```

### Modal Content Structure
1. **Header**: "Create Reminder" / "Set up a new reminder for [LineName]"
2. **Body** (scrollable via flex layout):
   - Message textarea (required)
   - Date picker (required)
   - Time picker (required, default 9:00 AM)
   - Recurrence section:
     - Checkbox: "Make this recurring"
     - If checked, show:
       - Frequency dropdown (daily/weekly/monthly/custom)
       - Conditional fields based on frequency
       - End date checkbox + picker
3. **Footer**: Discard changes / Save Reminder

### Validation
- Message required (non-empty)
- Date required
- Time required
- If recurring weekly: at least one day selected

### Post-Success
- `toast.success('Reminder created')`
- Close modal
- `router.refresh()`

### Reusable Form Component Extraction

Extract the reminder creation form fields into a reusable component:

**File:** `src/components/ultaura/CreateReminderForm.tsx`

This is a **form component** (not a Radix Dialog itself).

```tsx
interface CreateReminderFormProps {
  // Line context (from LineRow)
  lineId: string;
  lineName: string;
  timezone: string; // For "today" min date calculation and time labels

  // Form state callbacks
  onSuccess: () => void;
  onHasChangesChange?: (hasChanges: boolean) => void;
}

export function CreateReminderForm({
  lineId,
  lineName,
  timezone,
  onSuccess,
  onHasChangesChange,
}: CreateReminderFormProps) {
  // Form state and logic here
}
```

**Why these props:**
- `timezone`: For calculating "today" minimum date and displaying times correctly
- `onHasChangesChange`: Parent modal needs dirty state for close guard

### Testing Checklist
- [ ] Open modal from "New Reminder" button
- [ ] Open modal from empty state CTA
- [ ] All form fields work (message, date, time)
- [ ] Recurrence toggle shows/hides options
- [ ] Frequency selection changes visible fields
- [ ] Weekly frequency shows day selection
- [ ] Monthly frequency shows day-of-month
- [ ] Custom frequency shows interval input
- [ ] End date toggle works
- [ ] Modal scrolls when content is tall (footer stays visible)
- [ ] Validation errors show for empty required fields
- [ ] Validation error for weekly with no days
- [ ] Submit shows loading spinner
- [ ] Success closes modal and refreshes
- [ ] Error shows inline banner
- [ ] Dirty close guard works
- [ ] Focus moves to message textarea on open

---

## Conversion 3: UsageCapControl Modal
**Removed from scope.** No changes to `src/app/dashboard/(app)/usage/components/UsageCapControl.tsx`.

---

## Conversion 3: RemindersPageClient Add Modal

**File:** `src/app/dashboard/(app)/reminders/RemindersPageClient.tsx`

### Current UX
- "Add for [LineName]" buttons (one per line) that navigate away
- Navigates to `/dashboard/lines/${line.short_id}/reminders`

### Target UX
- Single "Add Reminder" button
- Opens modal:
  - **Step 1** (if multiple lines): Line picker
  - **Step 2**: Reminder form (embeds `CreateReminderForm`)
- If only 1 line, skip Step 1

**Modal styling requirement:** Both steps must match the “New exception” modal structure and button styles. Step 2 supports scrolling.

### Trigger Placement
- Replace "Add for [LineName]" button section with single "Add Reminder" button
- Empty state also shows "Add Reminder" button

### Architecture: AddReminderModal wrapping CreateReminderForm

**File:** `src/components/ultaura/AddReminderModal.tsx`

```tsx
// Line shape for the modal (subset of LineRow)
// Line shape for the modal (subset of LineRow, mapped to camelCase)
// Map from LineRow: line.display_name → displayName, line.phone_e164 → phoneE164
interface LineForReminderModal {
  id: string;
  displayName: string; // from line.display_name
  timezone: string;
  phoneE164: string; // For display in line picker (from line.phone_e164)
}

interface AddReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: LineForReminderModal[];
}

function AddReminderModal({ open, onOpenChange, lines }: AddReminderModalProps) {
  const [step, setStep] = useState<1 | 2>(lines.length === 1 ? 2 : 1);
  const [selectedLine, setSelectedLine] = useState<LineForReminderModal | null>(
    lines.length === 1 ? lines[0] : null
  );
  const [formHasChanges, setFormHasChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      if (lines.length === 1) {
        setSelectedLine(lines[0]);
        setStep(2);
      } else {
        setSelectedLine(null);
        setStep(1);
      }
      setFormHasChanges(false);
    }
  }, [open, lines]);

  // Back button handler with dirty check
  const handleBack = () => {
    if (formHasChanges) {
      setShowDiscardConfirm(true);
    } else {
      setStep(1);
      setSelectedLine(null);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setFormHasChanges(false);
    setStep(1);
    setSelectedLine(null);
  };

  // Step 2 renders CreateReminderForm
  // Pass onHasChangesChange={setFormHasChanges} to track dirty state
}
```

### Step 2 → Back Dirty Handling (Allowed Exception)

Because this modal is multi-step, Step 2 must guard “Back” when the form is dirty:
- Show a ConfirmationDialog: “Discard changes?” / “Going back will discard your reminder details.”
- Confirm returns to Step 1 and resets form state.

### Modal Content Structure

**Step 1 - Line Selection** (only if multiple lines):
1. **Header**: "Add Reminder" / "Which line is this reminder for?"
2. **Body**:
   - List of lines as selectable cards
   - Each shows `displayName` and `phoneE164` (formatted)
3. **Footer**: Discard changes / Continue (Continue disabled until line selected)

**Step 2 - Reminder Form**:
1. **Header**: "Add Reminder" / "Create a reminder for [selectedLine.displayName]"
2. **Body**: Embed `CreateReminderForm` with selected line's data
3. **Footer**:
   - If multiple lines: Back (styled like Discard) / Save Reminder
   - If single line: Discard changes / Save Reminder

### Server Action
- `CreateReminderForm` internally calls `createReminder` from `~/lib/ultaura/reminders`
- Requires `lineId` from selected line

### Post-Success
- `toast.success('Reminder created')`
- Close modal
- `router.refresh()`

### Testing Checklist
- [ ] Single line: modal opens directly to form
- [ ] Multiple lines: modal shows line picker first
- [ ] Line cards show `displayName` and formatted `phoneE164`
- [ ] Continue disabled until line selected
- [ ] Back button returns to line picker (if no changes)
- [ ] Back button shows discard confirm (if form has changes)
- [ ] Discard confirm returns to Step 1 and resets form
- [ ] Form validation same as line-specific page
- [ ] Success closes modal and refreshes list
- [ ] Dirty close guard works at step 2
- [ ] Step 1 closes without confirm (no form data yet)

---

## Conversion 4: CallsPageClient Add Modal

**File:** `src/app/dashboard/(app)/calls/CallsPageClient.tsx`

### Current UX
- "Add for [LineName]" buttons (one per line) that navigate away
- Navigates to `/dashboard/lines/${line.short_id}/schedule`

### Target UX
- Single "Add Schedule" button
- Opens modal:
  - **Step 1** (if multiple lines): Line picker
  - **Step 2**: Schedule form (embeds `CreateScheduleForm`)
- If only 1 line, skip Step 1

**Modal styling requirement:** Both steps must match the “New exception” modal structure and button styles. Step 2 supports scrolling.

### Architecture: AddScheduleModal wrapping CreateScheduleForm

**File:** `src/components/ultaura/AddScheduleModal.tsx`

```tsx
// Line shape for the modal (subset of LineRow, mapped to camelCase)
// Map from LineRow: line.account_id → accountId, line.display_name → displayName, etc.
interface LineForScheduleModal {
  id: string;
  accountId: string; // REQUIRED for createSchedule server action (from line.account_id)
  displayName: string; // from line.display_name
  timezone: string; // REQUIRED by CreateScheduleInputSchema
  quietHoursStart: string; // from line.quiet_hours_start
  quietHoursEnd: string; // from line.quiet_hours_end
  phoneE164: string; // For display in line picker (from line.phone_e164)
}

interface AddScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: LineForScheduleModal[];
  existingSchedulesByLine: Record<string, ScheduleRow[]>;
}
```

### API Requirement: createSchedule Schema

**Critical:** The `createSchedule` server action has a specific schema (from `packages/schemas/src/schedule.ts`):

```tsx
// CreateScheduleInputSchema requires:
{
  lineId: string; // UUID
  timezone: string; // Valid IANA timezone
  daysOfWeek: number[]; // 0-6, at least one day
  timeOfDay: string; // HH:mm format
  retryPolicy?: { maxRetries: number; retryWindowMinutes: number };
}

// Server action call:
await createSchedule(accountId, {
  lineId: selectedLine.id,
  timezone: selectedLine.timezone,
  daysOfWeek: selectedDays,
  timeOfDay: selectedTime,
});
```

**Note:** The schema uses camelCase (`lineId`, `daysOfWeek`, `timeOfDay`), not snake_case.

### Step 2 → Back Dirty Handling

Same as RemindersPageClient - show discard confirmation if form has changes.

### Testing Checklist
- [ ] Single line: modal opens directly to form
- [ ] Multiple lines: modal shows line picker first
- [ ] Line cards show `displayName` and formatted `phoneE164`
- [ ] Continue disabled until line selected
- [ ] Back button with dirty state shows discard confirm
- [ ] Form validation same as line-specific page
- [ ] Success closes modal and refreshes list
- [ ] `account_id` and `timezone` correctly passed from selected line
- [ ] Dirty close guard works at step 2

---

## Conversion 5: SettingsClient to Read-Only Cards + Modals

**Removed from scope.** No changes to `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`.

---

## Conversion 5: DebugLogFilters Modal (Admin)

**File:** `src/app/ultaura-admin/debug-logs/components/DebugLogFilters.tsx`

### Current UX
- Inline filter panel with 6 fields in 3-column grid
- Apply/Reset buttons
- Form submission via GET (server component)

### Target UX
- "Filters" button in header area
- Opens modal with all filter fields
- Footer buttons (2 buttons only) match “New exception” 1:1:
  - Left: **“Discard changes”** (closes modal without navigation)
  - Right: **“Apply filters”** (submits GET)
- Applied filters summary shown near list title
- **Preserve form method="GET"** - only modal open/close is client-side

**Modal styling requirement:** Match the “New exception” modal 1:1 (header, X button styling, button styles), with scrolling enabled if needed.

### Architecture: Minimal Client Conversion

The current component is a server component. Keep the form behavior simple:

1. **DebugLogFilters stays server component** for the filters display/chips
2. **New client component** `FilterModal` handles only modal open/close state
3. Form inside modal uses standard `method="GET"` with `defaultValue` from URL params
4. Apply button is native form submit (navigates with GET params)
5. Clear button links to base path (no params)

```tsx
// DebugLogFiltersModal.tsx (client component - minimal)
'use client';

interface FilterModalProps {
  children: React.ReactNode; // The form content (server-rendered)
  activeFilterCount: number;
}

function FilterModal({ children, activeFilterCount }: FilterModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>
        Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

```tsx
// Inside the modal, form is standard GET
<form method="GET" action="/ultaura-admin/debug-logs">
  <input name="startDate" defaultValue={searchParams.startDate} />
  <input name="endDate" defaultValue={searchParams.endDate} />
  {/* ... other fields ... */}

  <div className="flex gap-3">
    <a href="/ultaura-admin/debug-logs">Clear All</a>
    <button type="submit">Apply Filters</button>
  </div>
</form>
```

### No Dirty State Tracking Needed

Since the form uses native GET submission:
- Modal closes on form submit (page navigation)
- “Clear all” becomes a link outside the modal (near the active filter summary) to remove query params
- User can close modal freely without losing data (it's just URL params)
- No complex client-side state management required

### Applied Filters Display

Show chips/badges for active filters (server-rendered):

```tsx
// Server component
function ActiveFilters({ searchParams }: { searchParams: Record<string, string> }) {
  const filters = Object.entries(searchParams).filter(([_, v]) => v);
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="text-muted-foreground">Filtered by:</span>
      {filters.map(([key, value]) => (
        <span key={key} className="px-2 py-1 rounded bg-muted">
          {formatFilterLabel(key, value)}
        </span>
      ))}
    </div>
  );
}
```

### Testing Checklist
- [ ] Filters button shows count when active
- [ ] Modal opens on button click
- [ ] Modal shows all 6 filter fields
- [ ] Current URL params pre-fill fields via defaultValue
- [ ] Apply submits form (GET navigation)
- [ ] Clear links to base path
- [ ] Applied filters chips display correctly
- [ ] Server-side protection still works (admin route)
- [ ] No complex client state management needed

---

## Reusable Components Summary

Create these shared components to avoid code duplication:

| Component | Type | Location | Used By |
|-----------|------|----------|---------|
| `CreateScheduleForm` | Form component | `src/components/ultaura/CreateScheduleForm.tsx` | ScheduleClient modal, AddScheduleModal |
| `CreateReminderForm` | Form component | `src/components/ultaura/CreateReminderForm.tsx` | RemindersClient modal, AddReminderModal |
| `AddScheduleModal` | Dialog wrapper | `src/components/ultaura/AddScheduleModal.tsx` | CallsPageClient |
| `AddReminderModal` | Dialog wrapper | `src/components/ultaura/AddReminderModal.tsx` | RemindersPageClient |
| `FilterModal` | Dialog wrapper | `src/app/ultaura-admin/debug-logs/components/FilterModal.tsx` | DebugLogFilters |

**Naming Convention:**
- `*Form` = Embeddable form component (not a Radix Dialog itself)
- `*Modal` = Complete dialog wrapper that may embed a Form component

---

## Implementation Order

Execute in this sequence:

1. **Extract CreateScheduleForm** - Create reusable form component from ScheduleClient
2. **ScheduleClient create modal** - Use extracted form component
3. **Extract CreateReminderForm** - Create reusable form component from RemindersClient
4. **RemindersClient create modal** - Use extracted form component
5. **AddReminderModal** - Dialog wrapper using CreateReminderForm
6. **AddScheduleModal** - Dialog wrapper using CreateScheduleForm
7. **DebugLogFilters modal** - Nice-to-have admin polish

---

## Verification Plan

### Per-Conversion Testing
Each conversion should pass its specific testing checklist above.

### Integration Testing
After all conversions:
1. Navigate through complete user flows (onboarding → line setup → settings → usage)
2. Verify no regressions in existing modal functionality
3. Test with keyboard-only navigation
4. Test with screen reader
5. Verify mobile responsiveness of all modals
6. Verify footer stays visible when body content overflows

### URL Compatibility Testing
- [ ] All existing Settings section URLs (`?tab=calling&section=language`, etc.) still work
- [ ] Deep links to specific settings sections work correctly
- [ ] Browser back/forward navigation works

### End-to-End Scenarios
1. **New user flow**: Create line → Add schedule → Add reminder → Configure settings
2. **Edit flow**: Change schedule → Edit reminder → Update settings → Adjust cap
3. **Multi-line flow**: Add reminder from overview (line picker) → Back with dirty state → Confirm discard → Select different line
4. **Dirty state flow**: Make changes → Try to close → Confirm discard → Verify reset

---

## Assumptions

1. Existing server actions remain unchanged (just called from modals instead of inline forms)
2. Modal width `max-w-[468px]` is appropriate for these forms
3. `router.refresh()` is sufficient for data updates (no need for optimistic updates)
4. Toast notifications are appropriate for success feedback
5. Form validation rules remain unchanged from current inline implementations
6. The `normalizeDays` function exists in ScheduleClient and should be reused

---

## Dependencies

- `@radix-ui/react-dialog` - Already in codebase
- `src/core/ui/Dialog.tsx` - Existing wrapper
- `src/core/ui/ConfirmationDialog.tsx` - Existing component
- `src/core/ui/modal-button-classes.ts` - Existing styles
- `sonner` - Toast notifications (already used)
- All existing server actions in `src/lib/ultaura/`

---

## Risk Mitigation

1. **Form height overflow**: Use exception-compatible scroll (fixed header/footer, scroll body)
2. **Data staleness**: Always `router.refresh()` after successful saves
3. **Accessibility regressions**: Match “New exception” modal structure; ensure initial focus in create modals
4. **Mobile usability**: Test modals on mobile viewports, ensure touch targets adequate
5. **Code duplication**: Extract reusable form components before implementing overview modals
6. **State mutation bugs**: Always use `normalizeDays` (or similar slice+sort pattern) for array comparisons
