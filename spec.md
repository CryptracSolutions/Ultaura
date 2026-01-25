# Modal Conversion Specification

## Objective

Convert inline forms and controls across the Ultaura dashboard into modal-based interactions, creating a consistent "read-only by default, editing is explicit" user experience. This specification covers surgical, incremental changes that follow established codebase patterns.

---

## Scope Summary

| Priority | Component | Conversion Type |
|----------|-----------|-----------------|
| 1 | ScheduleClient.tsx | Inline create form → Modal |
| 2 | RemindersClient.tsx | Inline create form → Modal |
| 3 | UsageCapControl.tsx | Inline dropdown → Selection modal |
| 4 | RemindersPageClient.tsx | Button-per-line → Single modal with line picker (reuses CreateReminderForm) |
| 5 | CallsPageClient.tsx | Button-per-line → Single modal with line picker (reuses CreateScheduleForm) |
| 6 | SettingsClient.tsx | Inline forms → Read-only cards + per-section modals (preserves all existing sidebar sections) |
| 7 | DebugLogFilters.tsx | Inline filter panel → Filters modal (Admin, form method="GET" preserved) |

**Out of Scope:** WellnessAlertsList.tsx and InsightsPageClient.tsx (single-filter UIs don't benefit from modals).

---

## Global Patterns & Conventions

### Modal Structure (Follow Existing Pattern)

All modals must follow the established structure in the codebase. **Critical**: The dialog content must use a flex column layout with constrained height to keep the footer visible while allowing the body to scroll.

```tsx
<Dialog open={isOpen} onOpenChange={handleOpenChange}>
  <DialogContent
    className="max-w-[468px] flex flex-col max-h-[85vh]"
    overlayClassName="bg-black/50 backdrop-blur-none"
    onInteractOutside={handleInteractOutside}
    onEscapeKeyDown={handleEscapeKeyDown}
    onOpenAutoFocus={handleAutoFocus}
  >
    {/* Header - Fixed */}
    <div className="flex items-start justify-between gap-4 flex-shrink-0">
      <div className="min-w-0">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className={modalIconButtonClass}
        aria-label="Close"
        disabled={isSubmitting}
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Error Banner - Fixed */}
    {error && (
      <div
        role="alert"
        className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive flex-shrink-0"
      >
        {error}
      </div>
    )}

    {/* Form Content - Scrollable */}
    <div className="flex-1 overflow-y-auto min-h-0">
      {/* Form fields */}
    </div>

    {/* Footer - Fixed */}
    <div className="flex gap-3 pt-2 flex-shrink-0">
      <button type="button" onClick={handleClose} className={modalSecondaryButtonClass}>
        Cancel
      </button>
      <button type="submit" disabled={isSubmitting} className={modalPrimaryButtonClass}>
        {isSubmitting ? <Spinner /> : 'Save'}
      </button>
    </div>
  </DialogContent>
</Dialog>
```

**Layout Requirements:**
- `DialogContent` must have `flex flex-col max-h-[85vh]`
- Header, error banner, and footer use `flex-shrink-0` to stay fixed
- Body uses `flex-1 overflow-y-auto min-h-0` to scroll when content overflows

### Dirty Close Guard Pattern

When user has unsaved changes and attempts to close:

1. **Block close events** (`onInteractOutside`, `onEscapeKeyDown`, X button click)
2. **Show ConfirmationDialog** with:
   - Title: "Unsaved changes"
   - Description: "You have unsaved changes. Discard and close?"
   - Cancel: "Stay here"
   - Confirm: "Discard & close" (variant: default)
3. **Allow close immediately** when form is clean (no changes)
4. **Block all close methods** while submitting (disable X button, prevent outside/Escape)

```tsx
const handleClose = useCallback(() => {
  if (isSubmitting) return;
  if (hasChanges) {
    setShowDiscardConfirm(true);
  } else {
    closeModal();
  }
}, [isSubmitting, hasChanges, closeModal]);

const handleInteractOutside = useCallback((e: Event) => {
  if (isSubmitting || hasChanges) {
    e.preventDefault();
    if (hasChanges && !isSubmitting) setShowDiscardConfirm(true);
  }
}, [isSubmitting, hasChanges]);
```

### Save Behavior

- **Immediate save**: Each modal saves its own data on submit
- **On success**: `toast.success()` + close modal + `router.refresh()`
- **On error**: Inline error banner (role="alert") + modal stays open
- **During submit**: Disable all close methods and submit button, show spinner

### Accessibility Requirements

1. `aria-label="Close"` on X button
2. `DialogTitle` + `DialogDescription` for screen reader labeling
3. `role="alert"` on error banners
4. Focus first input on open via `onOpenAutoFocus`:
   ```tsx
   onOpenAutoFocus={(e) => {
     e.preventDefault();
     firstInputRef.current?.focus();
   }}
   ```
5. Natural tab order (Radix handles focus trap)
6. Enter submits form; Escape follows dirty-close guard

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
- Cancel/Create buttons in fixed footer

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
3. **Footer**: Cancel / Create Schedule

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
- Modal body scrollable (using flex layout pattern)
- Recurrence options in collapsible/optional section (checkbox to enable)
- Cancel/Create buttons in fixed footer

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
3. **Footer**: Cancel / Create Reminder

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

**File:** `src/app/dashboard/(app)/usage/components/UsageCapControl.tsx`

### Current UX
- Inline dropdown immediately saves on change
- Shows current cap value in dropdown
- Optimistic update with revert on failure

### Target UX
- Read-only card displays current cap + explanation
- "Edit cap" button opens modal
- Modal shows options as radio buttons or selectable cards
- Cancel/Save in footer
- Save triggers server action

### Trigger Placement
- Add "Edit cap" button to current display card
- Keep current card layout, make dropdown value read-only text

### Form State Strategy
- `showModal` boolean
- `selectedCap` for modal selection (initialize from current)
- `hasChanges` = selectedCap !== currentCap

### Implementation Details

```tsx
// Props remain same
interface UsageCapControlProps {
  accountId: string;
  capCents: number;
  disabled?: boolean;
}

// State
const [showModal, setShowModal] = useState(false);
const [selectedCap, setSelectedCap] = useState<string>('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);

// Open handler
const openModal = () => {
  setSelectedCap(String(capCents));
  setError(null);
  setShowModal(true);
};

// Save handler
const handleSave = async () => {
  setIsSubmitting(true);
  setError(null);
  try {
    const result = await updateOverageCap(accountId, Number(selectedCap));
    if (!result.success) {
      setError(result.error?.message || 'Failed to update cap');
      return;
    }
    toast.success('Spending cap updated');
    setShowModal(false);
    router.refresh();
  } catch {
    setError('An unexpected error occurred');
  } finally {
    setIsSubmitting(false);
  }
};

const hasChanges = selectedCap !== String(capCents);
```

### Modal Content Structure
1. **Header**: "Edit Spending Cap" / "Set a limit on overage charges"
2. **Body**:
   - Explanation text: "When your included minutes run out, calls continue at $0.15/min. Set a cap to limit how much you can be charged."
   - Radio group or selectable cards for cap options:
     - No limit ($0)
     - $10
     - $25
     - $50
     - $100
   - Each option shows what happens: "Calls will stop when you reach this amount"
3. **Footer**: Cancel / Save

### Cap Options
```tsx
const CAP_OPTIONS = [
  { value: '0', label: 'No limit', description: 'Calls continue with no cap on overage charges' },
  { value: '1000', label: '$10', description: 'Calls stop after $10 in overage charges' },
  { value: '2500', label: '$25', description: 'Calls stop after $25 in overage charges' },
  { value: '5000', label: '$50', description: 'Calls stop after $50 in overage charges' },
  { value: '10000', label: '$100', description: 'Calls stop after $100 in overage charges' },
];
```

### Post-Success
- `toast.success('Spending cap updated')`
- Close modal
- `router.refresh()` (updates server-rendered progress UI)

### Testing Checklist
- [ ] Read-only card shows current cap correctly
- [ ] "Edit cap" button opens modal
- [ ] Modal shows all 5 cap options
- [ ] Current cap is pre-selected
- [ ] Selecting different option enables Save
- [ ] Same option = no changes = close without confirm
- [ ] Save shows loading spinner
- [ ] Success closes modal and updates display
- [ ] Error shows inline banner
- [ ] Disabled prop hides Edit button

---

## Conversion 4: RemindersPageClient Add Modal

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

### Step 2 → Back Dirty Handling

When user is at Step 2 with unsaved form changes and clicks "Back":

1. Show ConfirmationDialog with:
   - Title: "Discard changes?"
   - Description: "Going back will discard your reminder details."
   - Cancel: "Stay here"
   - Confirm: "Discard & go back"
2. On confirm: Reset form state, return to Step 1
3. On cancel: Stay on Step 2

### Modal Content Structure

**Step 1 - Line Selection** (only if multiple lines):
1. **Header**: "Add Reminder" / "Which line is this reminder for?"
2. **Body**:
   - List of lines as selectable cards
   - Each shows `displayName` and `phoneE164` (formatted)
3. **Footer**: Cancel / Continue (disabled until line selected)

**Step 2 - Reminder Form**:
1. **Header**: "Add Reminder" / "Create a reminder for [selectedLine.displayName]"
2. **Body**: Embed `CreateReminderForm` with selected line's data
3. **Footer**:
   - If multiple lines: Back / Create Reminder
   - If single line: Cancel / Create Reminder

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

## Conversion 5: CallsPageClient Add Modal

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

## Conversion 6: SettingsClient to Read-Only Cards + Modals

**File:** `src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`

### Current UX
- 3 tabs with sidebar navigation (one section visible at a time)
- All changes batched until "Save Changes" button
- Unsaved changes warning on navigation

### Target UX (Surgical - Preserves All Existing Section URLs)

**Critical:** Keep all existing sidebar section values unchanged to preserve bookmarked URLs.

- **Keep existing 3 tabs with sidebar navigation**
- **Keep all 12 existing sidebar sections** (no consolidation)
- The currently active section becomes a read-only card with "Edit" button
- "Edit" opens section-specific modal
- Each modal saves immediately on submit
- **Remove global "Save Changes" button** - no more batched saves

### Existing Sidebar Sections (Preserved Exactly)

From `LineSettingsSectionValue` type and `buildLineSettingsSections`:

**Tab 1: Calling & Availability**
| Section Value | Label | Modal |
|---------------|-------|-------|
| `language` | Language | Language modal |
| `voice-preference` | Voice Preference | Voice Preference modal |
| `timezone` | Timezone | Timezone modal |
| `quiet-hours` | Quiet Hours | Quiet Hours modal |
| `voicemail` | Voicemail | Voicemail modal |
| `inbound` | Inbound Calls | Inbound Calls modal |
| `voice-controls` | Voice Controls | Voice Controls modal |
| `vacation` | Vacation | Vacation modal (refactored) |

**Tab 2: Insights & Notifications**
| Section Value | Label | Modal |
|---------------|-------|-------|
| `insights-privacy` | Insights & Privacy | Insights & Privacy modal |
| `weekly-summary` | Weekly Summary | Weekly Summary modal |
| `missed-calls` | Missed Call Alerts | Missed Call Alerts modal |

**Tab 3: Accessibility**
| Section Value | Label | Modal |
|---------------|-------|-------|
| `accessibility` | Accessibility | Accessibility modal |

**URL compatibility:** All existing URLs like `?tab=calling&section=quiet-hours` continue to work exactly as before.

### Section Modals Detail

All Settings modals use `updateLine(lineId, input)` which validates against `UpdateLineInputSchema` from `packages/schemas/src/line.ts`. **Critical:** The schema expects camelCase field names, not snake_case database column names.

#### 6.1 Language Modal
**Fields:**
- Language dropdown (with auto-detect option)

**Server Action:**
```tsx
await updateLine(line.id, { preferredLanguageIso: selectedLanguage });
// Set to null for auto-detect
await updateLine(line.id, { preferredLanguageIso: null });
```

#### 6.2 Voice Preference Modal
**Fields:**
- Voice preference (VoiceSelector component)

**Server Action:**
```tsx
await updateLine(line.id, { preferredGrokVoice: selectedVoice });
// Valid values: 'Ara' | 'Eve' | 'Leo' | 'Rex' | 'Sal'
```

#### 6.3 Timezone Modal
**Fields:**
- Timezone dropdown

**Server Action:**
```tsx
await updateLine(line.id, { timezone: selectedTimezone });
// Must be valid IANA timezone (e.g., 'America/New_York')
```

#### 6.4 Quiet Hours Modal
**Fields:**
- Quiet hours start time
- Quiet hours end time

**Server Action:**
```tsx
await updateLine(line.id, {
  quietHoursStart: startTime, // HH:mm format
  quietHoursEnd: endTime,     // HH:mm format
});
```

#### 6.5 Voicemail Modal
**Fields:**
- Voicemail behavior radio group (none/brief/detailed)

**Server Action:**
```tsx
await updateLine(line.id, { voicemailBehavior: selectedBehavior });
// Valid values: 'none' | 'brief' | 'detailed'
```

#### 6.6 Inbound Calls Modal
**Fields:**
- Inbound calls allowed toggle

**Server Action:**
```tsx
await updateLine(line.id, { inboundAllowed: isAllowed });
```

**Note:** Even though this is a single toggle, using a modal maintains consistency with the "editing is explicit" principle across all settings.

#### 6.7 Voice Controls Modal
**Fields:**
- Allow voice reminder control (switch)
- Allow voice schedule control (switch)

**Server Action:**
```tsx
await updateLine(line.id, {
  allowVoiceReminderControl: reminderControlEnabled,
  allowVoiceScheduleControl: scheduleControlEnabled,
});
```

#### 6.8 Vacation Modal (Refactored for Immediate Persist)

**Current Problem:** VacationSettings has pending local state for the add-range form; persistence happens via page's global "Save Changes".

**Solution:** Refactor to immediate persist for completed ranges, but keep dirty-close guard for partially-filled add-range form.

**Fields:**
- Vacation ranges list (read-only display of saved ranges)
- Add range form (start date, end date)
- Remove range buttons

**Behavior:**
- "Add vacation range" button validates the form, then immediately calls `addVacationRange()` server action
- On successful add: `toast.success()` + `router.refresh()` + clear form inputs
- "Remove" button immediately calls `removeVacationRange()` server action
- On successful remove: `toast.success()` + `router.refresh()`
- Modal close button follows dirty-close guard **only for unsaved add-range form inputs** (if user has typed start/end dates but not clicked Add)

**Dirty State:**
- `hasChanges` = add-range form has any input (start or end date input is non-empty)
- If user tries to close with partially-filled form, show discard confirmation
- Saved ranges are already persisted, so removing a range and closing is fine

**Server Actions (from `src/lib/ultaura/vacation.ts`):**

```tsx
// Add a vacation range
// VacationRange = { start: string, end: string } (ISO date format YYYY-MM-DD)
await addVacationRange(line.id, { start: startDate, end: endDate });

// Remove a vacation range (identified by start date)
await removeVacationRange(line.id, range.start);
```

**Note:** The `removeVacationRange` function uses `start` as the range identifier, not a separate `rangeId`. Each vacation range is uniquely identified by its start date.

#### 6.9 Insights & Privacy Modal
**Fields (self-managed):**
- Insights enabled (switch)
- Pause mode (switch)
- Pause reason (text input, if paused)

**Fields (family-managed):**
- Read-only status badge
- "Request Change" button (existing flow)

**Server Actions:**
- `updateInsightPrivacy()` for insights_enabled
- `setPauseMode()` for pause toggle

#### 6.10 Weekly Summary Modal
**Fields:**
- Enable weekly summary (switch)
- Day of week dropdown
- Time dropdown

**Server Action:** `updateNotificationPreferences()`

#### 6.11 Missed Call Alerts Modal
**Fields:**
- Enable missed call alerts (switch)
- Threshold dropdown (2-5 calls)

**Server Action:** `updateNotificationPreferences()`

#### 6.12 Accessibility Modal
**Fields:**
- Hearing mode dropdown (normal/enhanced_clarity/slow_pace)
- Cognitive mode dropdown (normal/supportive/high_support)
- Advanced section (collapsible):
  - Speech rate number input
  - Context window calls number input

**Server Action:** `updateAccessibilitySettings()`

### Data Flow: Props → Card → Modal → Save

**Important:** The read-only card displays current values from the page's props (passed down from server component). When the user clicks "Edit", the modal initializes its form state from those same props. On successful save, `router.refresh()` re-fetches server data, updating the props and thus the card display. This ensures consistency without optimistic updates.

### Read-Only Card Component

Create a reusable component for consistent read-only display:

```tsx
interface SettingsCardProps {
  title: string;
  icon: React.ReactNode;
  onEdit: () => void;
  disabled?: boolean;
  children: React.ReactNode; // current values display
}

function SettingsCard({ title, icon, onEdit, disabled, children }: SettingsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
          <h3 className="font-medium">{title}</h3>
        </div>
        <button
          onClick={onEdit}
          disabled={disabled}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          Edit
        </button>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
```

### State Management Changes
- Remove global batch state tracking
- Remove global `handleSubmit` function
- Remove `hasSaveableChanges` computation
- Remove global "Save Changes" button
- Each modal manages its own state independently
- Remove `useLeavePageGuard` (no longer needed - no pending changes except Vacation add-form)

### Testing Checklist
- [ ] Tab + sidebar navigation unchanged
- [ ] All 12 existing section URLs continue to work
- [ ] Each sidebar section shows read-only card
- [ ] Each card shows current values accurately
- [ ] Edit button opens correct modal
- [ ] Each modal pre-fills with current values
- [ ] Each modal saves independently with `router.refresh()`
- [ ] Success toast + close + refresh
- [ ] Error handling per modal
- [ ] Family-managed restrictions work (Insights)
- [ ] Vacation add persists immediately, remove persists immediately
- [ ] Vacation modal: dirty-close guard for partially-filled add-form only
- [ ] No stale data after edits
- [ ] Disabled state disables all Edit buttons
- [ ] No global Save button exists

---

## Conversion 7: DebugLogFilters Modal (Admin)

**File:** `src/app/ultaura-admin/debug-logs/components/DebugLogFilters.tsx`

### Current UX
- Inline filter panel with 6 fields in 3-column grid
- Apply/Reset buttons
- Form submission via GET (server component)

### Target UX
- "Filters" button in header area
- Opens modal with all filter fields
- Apply/Clear buttons in modal footer
- Applied filters summary shown near list title
- **Preserve form method="GET"** - only modal open/close is client-side

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
- Modal closes on Clear (link navigation)
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
| `SettingsCard` | Display component | `src/components/ultaura/SettingsCard.tsx` | SettingsClient |
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
5. **UsageCapControl modal** - Small, validates save/refresh UX
6. **AddReminderModal** - Dialog wrapper using CreateReminderForm
7. **AddScheduleModal** - Dialog wrapper using CreateScheduleForm
8. **SettingsClient modals** - Largest surface area, implement section by section
9. **DebugLogFilters modal** - Nice-to-have admin polish

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
2. Modal width `max-w-[468px]` is appropriate for most forms; Settings modals may use `max-w-lg`
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

1. **State complexity in SettingsClient**: Start with simpler modals first to validate patterns
2. **Form height overflow**: Use flex column layout with `flex-1 overflow-y-auto min-h-0` for body
3. **Data staleness**: Always `router.refresh()` after successful saves
4. **Accessibility regressions**: Follow existing patterns exactly, test with screen reader
5. **Mobile usability**: Test modals on mobile viewports, ensure touch targets adequate
6. **Code duplication**: Extract reusable form components before implementing overview modals
7. **State mutation bugs**: Always use `normalizeDays` (or similar slice+sort pattern) for array comparisons
8. **URL compatibility**: Preserve all existing sidebar section values to avoid breaking bookmarks
