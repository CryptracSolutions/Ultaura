# Modal Conversion Specification

This specification defines the conversion of inline forms to modal-based interactions in the Ultaura codebase. All conversions follow the established modal pattern demonstrated in `MilestonesClient.tsx` and `ContactsClient.tsx`.

---

## Table of Contents

1. [Established Modal Pattern](#established-modal-pattern)
   - [Visual Standards](#visual-standards)
   - [Required Imports](#required-imports)
   - [Modal Dirty-Close Guard Pattern](#modal-dirty-close-guard-pattern) *(critical)*
   - [Focus & Accessibility](#focus--accessibility)
2. [Priority 1: LineDetailClient.tsx - Topics Modal](#priority-1-linedetailclienttsx---topics-modal)
3. [Priority 2: VacationSettings.tsx - Add Vacation Modal](#priority-2-vacationsettingstsx---add-vacation-modal)
4. [Priority 3: PrivacyCenterClient.tsx - Invite Recipient Modal](#priority-3-privacycenterclienttsx---invite-recipient-modal)
5. [Priority 4: AlertSettings.tsx - Read-Only Cards with Edit Modal](#priority-4-alertsettingstsx---read-only-cards-with-edit-modal)
6. [Priority 5: EditScheduleClient.tsx - Legacy Cleanup](#priority-5-editscheduleclienttsx---legacy-cleanup)
7. [Testing Checklist](#testing-checklist)
8. [File Changes Summary](#file-changes-summary)
9. [Reference Files](#reference-files)
10. [Assumptions](#assumptions)
11. [Important Clarifications](#important-clarifications)

---

## Established Modal Pattern

### Visual Standards

| Element | Specification |
|---------|---------------|
| **Overlay** | `bg-black/50 backdrop-blur-none` |
| **Width** | `max-w-[468px]` |
| **Header** | Title + description on left, X close button on right |
| **Footer** | `flex gap-3 pt-2` with equal-width buttons (`flex-1`) |

### Required Imports

```tsx
import { useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import {
  modalIconButtonClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/core/ui/Tooltip';
import { X } from 'lucide-react';
```

> **Note**: Do NOT use `useLeavePageGuard` for modal dirty-close handling. That hook only guards page navigation (beforeunload, anchor clicks), not modal dismiss events. Use the modal-scoped pattern below instead.

### Button Classes

From `/src/core/ui/modal-button-classes.ts`:

- `modalIconButtonClass` - Close button (X)
- `modalPrimaryButtonClass` - Submit button (Save, Add, etc.)
- `modalSecondaryButtonClass` - Cancel button

### Loading Spinner

```tsx
<span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
```

### Error Display

```tsx
{error && (
  <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {error}
  </div>
)}
```

### Modal Structure Template

```tsx
<Dialog open={isOpen} onOpenChange={handleOpenChange}>
  <DialogContent
    className="max-w-[468px]"
    overlayClassName="bg-black/50 backdrop-blur-none"
  >
    {/* Header */}
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle className="truncate">Modal Title</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Description text explaining the purpose.
        </DialogDescription>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className={modalIconButtonClass}
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Error display */}
    {error && (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    )}

    {/* Form */}
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields */}

      {/* Footer buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className={modalSecondaryButtonClass}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={modalPrimaryButtonClass}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

### Modal Dirty-Close Guard Pattern

**Critical**: The `useLeavePageGuard` hook only guards page navigation (beforeunload, anchor clicks). It does NOT intercept modal dismiss events (overlay click, Escape key, X button, `onOpenChange`). Each modal must implement its own dirty-close guard using modal-scoped state.

#### Required State Variables

```tsx
const [isOpen, setIsOpen] = useState(false);
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
const firstInputRef = useRef<HTMLInputElement>(null);

// Dirty state detection (modal-specific logic)
const hasChanges = /* compare current form state to initial state */;
```

#### Close Attempt Handler

```tsx
// Called by X button, Cancel button, and onOpenChange when closing
const attemptClose = useCallback(() => {
  if (hasChanges && !isSubmitting) {
    setShowDiscardConfirm(true); // Show confirmation dialog
  } else {
    closeModal(); // Clean close
  }
}, [hasChanges, isSubmitting]);

const closeModal = useCallback(() => {
  resetForm();
  setIsOpen(false);
  setShowDiscardConfirm(false);
}, [resetForm]);

const confirmDiscard = useCallback(() => {
  setShowDiscardConfirm(false);
  closeModal();
}, [closeModal]);

const cancelDiscard = useCallback(() => {
  setShowDiscardConfirm(false);
  // Modal stays open
}, []);
```

#### Dialog Configuration with Interception

```tsx
<Dialog
  open={isOpen}
  onOpenChange={(open) => {
    if (open) {
      // Opening path (only needed if using DialogTrigger, not explicit setIsOpen)
      setIsOpen(true);
    } else {
      // Closing path - intercept close from overlay click, Escape, or programmatic close
      attemptClose();
    }
  }}
>
  <DialogContent
    className="max-w-[468px]"
    overlayClassName="bg-black/50 backdrop-blur-none"
    // Prevent default close behavior when dirty (Radix props)
    onInteractOutside={(e) => {
      if (hasChanges && !isSubmitting) {
        e.preventDefault();
        attemptClose();
      }
    }}
    onEscapeKeyDown={(e) => {
      if (hasChanges && !isSubmitting) {
        e.preventDefault();
        attemptClose();
      }
    }}
    // Focus management
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      firstInputRef.current?.focus();
    }}
  >
    {/* Modal content */}
  </DialogContent>
</Dialog>

{/* Discard Confirmation Dialog - use established app-wide copy */}
<ConfirmationDialog
  open={showDiscardConfirm}
  onOpenChange={(open) => {
    if (!open) cancelDiscard();
  }}
  title="Unsaved changes"
  description="You have unsaved changes. Leave without saving?"
  confirmLabel="Discard & leave"
  cancelLabel="Stay here"
  variant="default"
  onConfirm={confirmDiscard}
/>
```

#### Key Implementation Points

1. **X button**: Calls `attemptClose()` directly via `onClick`
2. **Cancel button**: Calls `attemptClose()` directly via `onClick`
3. **Overlay click**: Intercepted by `onInteractOutside` with `e.preventDefault()` when dirty
4. **Escape key**: Intercepted by `onEscapeKeyDown` with `e.preventDefault()` when dirty
5. **`onOpenChange`**: Calls `attemptClose()` when `open` becomes `false`
6. **Confirmation "Discard"**: Calls `confirmDiscard()` which resets form and closes modal
7. **Confirmation "Keep editing"**: Calls `cancelDiscard()` which just hides confirmation

### Focus & Accessibility

#### Initial Focus
Use `onOpenAutoFocus` to programmatically focus the first input:

```tsx
<DialogContent
  onOpenAutoFocus={(e) => {
    e.preventDefault(); // Prevent Radix default focus behavior
    firstInputRef.current?.focus();
  }}
>
```

#### Required ARIA Labels
- Close button: `aria-label="Close"`
- Error regions: Use `role="alert"` for error messages that should be announced

```tsx
{error && (
  <div
    role="alert"
    className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
  >
    {error}
  </div>
)}
```

#### Keyboard Behavior
- **Tab order**: Natural top-to-bottom, left-to-right; first editable field focused on open
- **Enter**: Submits form (except in multiline `<textarea>` where Enter adds newline)
- **Escape**: Attempts close via `onEscapeKeyDown` → triggers confirmation if dirty

---

## Priority 1: LineDetailClient.tsx - Topics Modal

### File Location
`/src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx`

### Current State
- Lines 636-782: Inline edit-in-place form
- Topic chips from `INTEREST_TOPIC_OPTIONS` (22 curated options)
- Custom topic input (comma-separated)
- "Topics to avoid" textarea
- Max 5 topics limit with counter

### Target State
Single combined modal with both "Topics they enjoy" and "Topics to avoid" sections.

### Implementation Details

#### New State Variables
```tsx
const [showTopicsModal, setShowTopicsModal] = useState(false);
const [showTopicsDiscardConfirm, setShowTopicsDiscardConfirm] = useState(false);
const firstChipRef = useRef<HTMLButtonElement>(null);
```

#### Trigger Button (Replace inline Edit button)
```tsx
<button
  type="button"
  onClick={openTopicsModal}
  disabled={isReadOnly}
  className="text-sm text-primary hover:underline inline-flex items-center gap-2"
>
  <Edit2 className="w-4 h-4" />
  Edit
</button>
```

#### Modal Content Structure

Apply the modal-scoped dirty-close guard pattern:

```tsx
<Dialog
  open={showTopicsModal}
  onOpenChange={(open) => {
    if (!open) attemptCloseTopics();
  }}
>
  <DialogContent
    className="max-w-[468px]"
    overlayClassName="bg-black/50 backdrop-blur-none"
    onInteractOutside={(e) => {
      if (hasTopicChanges && !isSavingTopics) {
        e.preventDefault();
        attemptCloseTopics();
      }
    }}
    onEscapeKeyDown={(e) => {
      if (hasTopicChanges && !isSavingTopics) {
        e.preventDefault();
        attemptCloseTopics();
      }
    }}
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      firstChipRef.current?.focus();
    }}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle className="truncate">Conversation topics</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Customize what Ultaura discusses during calls.
        </DialogDescription>
      </div>
      <button type="button" onClick={attemptCloseTopics} className={modalIconButtonClass} aria-label="Close">
        <X className="w-4 h-4" />
      </button>
    </div>

    {error && (
      <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    )}

    <form onSubmit={handleTopicsSubmit} className="space-y-6">
      {/* Topics they enjoy section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-foreground">Topics they enjoy</div>
          <div className="text-xs text-muted-foreground">
            Selected: {topicsSelectedCount}/{MAX_INTEREST_TOPICS}
          </div>
        </div>

        {/* Scrollable chips container */}
        <div className="max-h-32 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {INTEREST_TOPIC_OPTIONS.map((topic, index) => (
              <button
                key={topic}
                ref={index === 0 ? firstChipRef : undefined}
                type="button"
                onClick={() => toggleTopic(topic)}
                disabled={!topicChips.includes(topic) && combinedTopics.length >= MAX_INTEREST_TOPICS}
                className={/* existing chip classes */}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Custom topics input */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Other topics (comma-separated)
          </label>
          <input
            value={topicCustom}
            onChange={(e) => setTopicCustom(e.target.value)}
            placeholder="e.g., baseball, baking, church"
            disabled={topicChips.length >= MAX_INTEREST_TOPICS}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
      </div>

      {/* Topics to avoid section */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">Topics to avoid</div>
        <textarea
          value={avoidTopicsText}
          onChange={(e) => setAvoidTopicsText(e.target.value)}
          placeholder="e.g., politics, health issues..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground">Separate topics with commas.</p>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={attemptCloseTopics} disabled={isSavingTopics} className={modalSecondaryButtonClass}>
          Cancel
        </button>
        <button type="submit" disabled={isSavingTopics} className={modalPrimaryButtonClass}>
          {isSavingTopics ? (
            <>
              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>

{/* Discard confirmation for Topics modal - use established app-wide copy */}
<ConfirmationDialog
  open={showTopicsDiscardConfirm}
  onOpenChange={(open) => {
    if (!open) setShowTopicsDiscardConfirm(false);
  }}
  title="Unsaved changes"
  description="You have unsaved changes. Leave without saving?"
  confirmLabel="Discard & leave"
  cancelLabel="Stay here"
  variant="default"
  onConfirm={() => {
    setShowTopicsDiscardConfirm(false);
    closeTopicsModal();
  }}
/>
```

#### Key Functions to Modify

**`openTopicsModal`** (replace `startEditingTopics`):
```tsx
const openTopicsModal = () => {
  if (isReadOnly) return;

  const interests = line.seed_interests ?? [];
  const avoid = line.seed_avoid_topics ?? [];

  const curatedSet = new Set(INTEREST_TOPIC_OPTIONS);
  const selected = interests.filter((t) => curatedSet.has(t));
  const custom = interests.filter((t) => !curatedSet.has(t));

  const initialState = {
    chips: dedupeTopics(selected).slice(0, MAX_INTEREST_TOPICS),
    custom: custom.join(', '),
    avoid: avoid.join(', '),
  };

  setInitialTopics(initialState);
  setTopicChips(initialState.chips);
  setTopicCustom(initialState.custom);
  setAvoidTopicsText(initialState.avoid);
  setError(null);
  setShowTopicsModal(true);
};
```

**`closeTopicsModal`** (unconditional close + reset):
```tsx
const closeTopicsModal = useCallback(() => {
  setTopicChips(initialTopics.chips);
  setTopicCustom(initialTopics.custom);
  setAvoidTopicsText(initialTopics.avoid);
  setError(null);
  setShowTopicsModal(false);
  setShowTopicsDiscardConfirm(false);
}, [initialTopics]);
```

**`attemptCloseTopics`** (dirty-check before close):
```tsx
const attemptCloseTopics = useCallback(() => {
  if (hasTopicChanges && !isSavingTopics) {
    setShowTopicsDiscardConfirm(true);
  } else {
    closeTopicsModal();
  }
}, [hasTopicChanges, isSavingTopics, closeTopicsModal]);
```

#### Dirty State Detection (existing, adapt for modal)
```tsx
const hasTopicChanges =
  showTopicsModal &&
  (normalizeTopicList(combinedTopics) !== normalizeTopicList(initialCombinedTopics) ||
    normalizeTopicList(parseTopics(avoidTopicsText)) !== normalizeTopicList(parseTopics(initialTopics.avoid)));
```

#### Validation Rules
- Combined topics (chips + custom) ≤ `MAX_INTEREST_TOPICS` (5)
- Duplicate detection via `dedupeTopics()` (case-insensitive)
- Empty topics filtered out

#### Read-Only View
Keep existing display (lines 759-780) - no changes needed.

---

## Priority 2: VacationSettings.tsx - Add Vacation Modal

### File Location
`/src/app/dashboard/(app)/lines/[lineId]/settings/VacationSettings.tsx`

### Current State
- Always-visible inline form with start/end date inputs
- List of vacation ranges with status badges (Active/Upcoming/Past)
- Delete functionality (disabled for past vacations)

### Target State
- Modal triggered by "Add Vacation" button in section header
- Empty state CTA when no vacations exist
- "Show past vacations" toggle (hide past by default)
- **Staging behavior preserved**: Modal adds to local state, parent Save persists
- After success: Inline success state with "Add another" / "Done" buttons

### Implementation Details

#### New State Variables
```tsx
const [showAddModal, setShowAddModal] = useState(false);
const [showPastVacations, setShowPastVacations] = useState(false);
const [addSuccess, setAddSuccess] = useState(false);
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
const startDateInputRef = useRef<HTMLInputElement>(null);
```

#### Section Header with Trigger Button
```tsx
{showHeader && (
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Palmtree className="w-4 h-4 text-muted-foreground" />
      Vacation Mode
    </div>
    <button
      type="button"
      onClick={() => openAddModal()}
      disabled={disabled}
      className="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
    >
      <Plus className="w-4 h-4" />
      Add Vacation
    </button>
  </div>
)}
```

#### Empty State CTA

**Important**: The empty state must distinguish between "no vacations at all" and "only past vacations exist but hidden".

```tsx
{activeAndUpcoming.length === 0 ? (
  <div className="text-center py-8 rounded-lg border border-dashed border-border">
    <Palmtree className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
    {pastVacations.length === 0 ? (
      // Truly empty - no vacations at all
      <p className="text-sm text-muted-foreground mb-4">No vacation ranges yet.</p>
    ) : (
      // Has past vacations but they're hidden
      <>
        <p className="text-sm text-muted-foreground mb-2">No upcoming vacations.</p>
        <button
          type="button"
          onClick={() => setShowPastVacations(true)}
          className="text-xs text-primary hover:underline mb-4"
        >
          Show {pastVacations.length} past vacation{pastVacations.length !== 1 ? 's' : ''}
        </button>
      </>
    )}
    {!disabled && (
      <button
        type="button"
        onClick={() => openAddModal()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {pastVacations.length === 0 ? 'Add First Vacation' : 'Add Vacation'}
      </button>
    )}
  </div>
) : (
  /* vacation list */
)}
```

#### Show/Hide Past Vacations Toggle
```tsx
{pastVacations.length > 0 && (
  <button
    type="button"
    onClick={() => setShowPastVacations(!showPastVacations)}
    className="text-xs text-muted-foreground hover:text-foreground"
  >
    {showPastVacations
      ? 'Hide past vacations'
      : `Show ${pastVacations.length} past vacation${pastVacations.length !== 1 ? 's' : ''}`}
  </button>
)}
```

#### Computed Values
```tsx
const pastVacations = useMemo(
  () => sortedRanges.filter((range) => getStatus(range) === 'past'),
  [sortedRanges]
);

const activeAndUpcoming = useMemo(
  () => sortedRanges.filter((range) => getStatus(range) !== 'past'),
  [sortedRanges]
);

const displayedRanges = showPastVacations ? sortedRanges : activeAndUpcoming;
```

#### Modal Structure with Success State and Dirty-Close Guard
```tsx
<Dialog
  open={showAddModal}
  onOpenChange={(open) => {
    if (open) {
      setShowAddModal(true);
    } else {
      attemptCloseVacation();
    }
  }}
>
  <DialogContent
    className="max-w-[468px]"
    overlayClassName="bg-black/50 backdrop-blur-none"
    onInteractOutside={(e) => {
      if (hasVacationFormChanges) {
        e.preventDefault();
        attemptCloseVacation();
      }
    }}
    onEscapeKeyDown={(e) => {
      if (hasVacationFormChanges) {
        e.preventDefault();
        attemptCloseVacation();
      }
    }}
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      startDateInputRef.current?.focus();
    }}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle className="truncate">Add vacation</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Pause all scheduled calls during this period.
        </DialogDescription>
      </div>
      <button type="button" onClick={attemptCloseVacation} className={modalIconButtonClass} aria-label="Close">
        <X className="w-4 h-4" />
      </button>
    </div>

    {error && (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    )}

    {addSuccess ? (
      /* Success state - staging behavior reminder */
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
            <CheckCircle className="w-4 h-4" />
            Added to pending changes
          </div>
          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
            Remember to click <strong>Save Changes</strong> to apply.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleAddAnother}
            className={modalSecondaryButtonClass}
          >
            Add another
          </button>
          <button
            type="button"
            onClick={closeModal}
            className={modalPrimaryButtonClass}
          >
            Done
          </button>
        </div>
      </div>
    ) : (
      <form onSubmit={handleAdd} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Start date</label>
            <input
              ref={startDateInputRef}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today ?? undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today || undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Dates are based on {line.timezone}.
        </p>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={attemptCloseVacation} className={modalSecondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" className={modalPrimaryButtonClass}>
            Add Vacation
          </button>
        </div>
      </form>
    )}
  </DialogContent>
</Dialog>

{/* Discard confirmation for Vacation modal - use established app-wide copy */}
<ConfirmationDialog
  open={showDiscardConfirm}
  onOpenChange={(open) => {
    if (!open) setShowDiscardConfirm(false);
  }}
  title="Unsaved changes"
  description="You have unsaved changes. Leave without saving?"
  confirmLabel="Discard & leave"
  cancelLabel="Stay here"
  variant="default"
  onConfirm={() => {
    setShowDiscardConfirm(false);
    closeModal();
  }}
/>
```

#### Key Functions

**`handleAdd`**:
```tsx
const handleAdd = (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (!startDate || !endDate) {
    setError('Select a start and end date');
    return;
  }

  // Explicit past-date validation (don't rely solely on <input min>)
  // Use line timezone for accurate comparison
  const todayInLineTimezone = DateTime.now()
    .setZone(line.timezone)
    .toFormat('yyyy-MM-dd');

  if (startDate < todayInLineTimezone) {
    setError('Start date cannot be in the past');
    return;
  }

  if (startDate > endDate) {
    setError('Start date must be before end date');
    return;
  }

  const overlaps = ranges.some(
    (range) => range.start <= endDate && range.end >= startDate
  );
  if (overlaps) {
    setError('Vacation range overlaps an existing range');
    return;
  }

  const updated = [...ranges, { start: startDate, end: endDate }].sort((a, b) =>
    a.start.localeCompare(b.start)
  );
  onRangesChange(updated);
  setAddSuccess(true);
};
```

> **Note**: The `DateTime` import is from `luxon`, already used in VacationSettings. This explicit validation prevents bypassing the `<input min>` constraint (e.g., via browser dev tools or pasting).

**`handleAddAnother`**:
```tsx
const handleAddAnother = () => {
  setAddSuccess(false);
  setStartDate('');
  setEndDate('');
  setError(null);
  // Return focus to start date input
};
```

**`closeModal`**:
```tsx
const closeModal = () => {
  setShowAddModal(false);
  setAddSuccess(false);
  setStartDate('');
  setEndDate('');
  setError(null);
};
```

#### Important Notes
- **Dirty-close guard for typed dates**: For consistency with other modals, show the "Unsaved changes" confirmation if user has typed dates but not clicked "Add Vacation". This prevents losing typed input via accidental overlay click/Escape.
- **Staging behavior preserved**: Modal adds to local `ranges` state via `onRangesChange`; changes only persist when parent SettingsClient "Save Changes" is clicked
- **Success copy**: Must communicate staging clearly - "Added to pending changes" with reminder to save, NOT "Vacation added successfully"
- **Validation alignment**: Client validates same rules as server (`startDate >= today` in line timezone, `startDate < endDate`, no overlaps)

#### Dirty State for Vacation Modal

Even though the modal stages locally, we should still guard against accidental close when the user has typed dates:

```tsx
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

// Dirty = user has typed something in the date fields (not yet added)
const hasVacationFormChanges = !addSuccess && (startDate !== '' || endDate !== '');

const attemptCloseVacation = useCallback(() => {
  if (hasVacationFormChanges) {
    setShowDiscardConfirm(true);
  } else {
    closeModal();
  }
}, [hasVacationFormChanges]);
```

Then apply `onInteractOutside`, `onEscapeKeyDown` interception as per the standard pattern.

---

## Priority 3: PrivacyCenterClient.tsx - Invite Recipient Modal

### File Location
`/src/app/dashboard/(app)/privacy/PrivacyCenterClient.tsx`

### Current State
- Lines 1401-1468: Inline form with 5 fields + checkbox
- 5-recipient limit with counter
- Reinvite flow for unsubscribed recipients

### Target State
- Modal triggered by "Invite Recipient" button
- Button disabled at 5-recipient limit with tooltip
- Dirty state warning on close

### Implementation Details

#### New State Variable
```tsx
const [showInviteModal, setShowInviteModal] = useState(false);
```

#### Trigger Button with Limit Handling

Use the `Tooltip` component (from `~/core/ui/Tooltip`) instead of the HTML `title` attribute for better accessibility and consistent styling:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <p className="text-xs text-muted-foreground">{recipients.length}/5 recipients</p>

  {recipients.length >= 5 ? (
    // At limit - show disabled button with tooltip
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium opacity-50 cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Invite Recipient
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Maximum 5 recipients reached</TooltipContent>
    </Tooltip>
  ) : (
    // Under limit - normal button
    <button
      type="button"
      onClick={() => setShowInviteModal(true)}
      disabled={isInviting}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus className="w-4 h-4" />
      Invite Recipient
    </button>
  )}
</div>
```

> **Note**: The `<span>` wrapper around the disabled button is required because Radix Tooltip's `asChild` doesn't work directly on disabled elements (they don't receive pointer events). The span receives the hover and passes it to the tooltip.

#### Modal Structure
```tsx
<Dialog open={showInviteModal} onOpenChange={handleInviteModalClose}>
  <DialogContent className="max-w-[468px]" overlayClassName="bg-black/50 backdrop-blur-none">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle className="truncate">Invite family recipient</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          This person will receive weekly summaries and wellness alerts.
        </DialogDescription>
      </div>
      <button type="button" onClick={closeInviteModal} className={modalIconButtonClass} aria-label="Close">
        <X className="w-4 h-4" />
      </button>
    </div>

    {inviteError && (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {inviteError}
      </div>
    )}

    <form onSubmit={handleInviteSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField>
          <TextField.Label>
            Name <span className="text-destructive">*</span>
            <TextField.Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g., Sarah Johnson"
              required
            />
          </TextField.Label>
        </TextField>
        <TextField>
          <TextField.Label>
            Email <span className="text-destructive">*</span>
            <TextField.Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="sarah@example.com"
              required
            />
          </TextField.Label>
        </TextField>
        <TextField>
          <TextField.Label>
            Phone {inviteAsTrusted ? <span className="text-destructive">*</span> : '(optional)'}
            <TextField.Input
              type="tel"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              placeholder="(555) 123-4567"
              required={inviteAsTrusted}
            />
          </TextField.Label>
        </TextField>
        <TextField>
          <TextField.Label>
            Relationship (optional)
            <TextField.Input
              value={inviteRelationship}
              onChange={(e) => setInviteRelationship(e.target.value)}
              placeholder="e.g., Daughter"
            />
          </TextField.Label>
        </TextField>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={inviteAsTrusted}
          onCheckedChange={(checked) => setInviteAsTrusted(Boolean(checked))}
        />
        Also add as emergency contact (requires phone number)
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={closeInviteModal}
          disabled={isInviting}
          className={modalSecondaryButtonClass}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isInviting}
          className={modalPrimaryButtonClass}
        >
          {isInviting ? (
            <>
              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sending
            </>
          ) : (
            'Send invite'
          )}
        </button>
      </div>
    </form>
  </DialogContent>
</Dialog>
```

#### Dirty State Detection and Close Guard

Use the modal-scoped dirty-close guard pattern (see [Modal Dirty-Close Guard Pattern](#modal-dirty-close-guard-pattern)):

```tsx
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
const firstInputRef = useRef<HTMLInputElement>(null);

const hasInviteChanges =
  inviteName.trim() !== '' ||
  inviteEmail.trim() !== '' ||
  invitePhone.trim() !== '' ||
  inviteRelationship.trim() !== '' ||
  inviteAsTrusted;

const attemptCloseInvite = useCallback(() => {
  if (hasInviteChanges && !isInviting) {
    setShowDiscardConfirm(true);
  } else {
    closeInviteModal();
  }
}, [hasInviteChanges, isInviting]);

const closeInviteModal = useCallback(() => {
  resetInviteForm();
  setShowInviteModal(false);
  setShowDiscardConfirm(false);
}, [resetInviteForm]);

const confirmDiscardInvite = useCallback(() => {
  setShowDiscardConfirm(false);
  closeInviteModal();
}, [closeInviteModal]);
```

Then apply `onInteractOutside`, `onEscapeKeyDown`, and `onOpenAutoFocus` to `DialogContent` as shown in the pattern section.

#### Reinvite Flow (preserve existing behavior)
When inviting an email that was previously unsubscribed:
```tsx
const handleInviteSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await handleInvite(false);
};

// In handleInvite, when result.error.details?.reason === 'unsubscribed':
// Show reinvite confirmation dialog (already exists)
```

#### Validation Rules
- Name: Required, trimmed
- Email: Required, valid email format
- Phone: Optional unless "emergency contact" checked, then required
- Phone format: E.164 via `TELEPHONY.PHONE_REGEX`
- Validation error: "Enter a valid US phone number"

---

## Priority 4: AlertSettings.tsx - Read-Only Cards with Edit Modal

### File Location
`/src/app/dashboard/(app)/alerts/AlertSettings.tsx`

### Current State
- Multiple cards per line with inline switches/select
- Each card has its own save/discard buttons
- Parent tracks dirty state across all cards

### Target State
- Read-only cards with status badges (Enabled/Disabled)
- Per-line "Edit" button opening modal
- Delivery method shown as static text with "coming soon" note

### Implementation Details

#### Read-Only Card Component

```tsx
function AlertSettingsCard({
  line,
  preferences,
  disabled = false,
  onEdit,
}: {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
  disabled?: boolean;
  onEdit: (line: LineRow, preferences: NotificationPreferencesRow | null) => void;
}) {
  const settings = buildDefaults(preferences);

  const StatusBadge = ({ enabled }: { enabled: boolean }) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        enabled
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{line.display_name}</p>
          <p className="text-xs text-muted-foreground">Wellness alert settings</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onEdit(line, preferences)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Bell className="w-4 h-4 text-muted-foreground" />
            Health mention alerts
          </div>
          <StatusBadge enabled={settings.healthMentionAlerts} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Mood drop alerts
          </div>
          <StatusBadge enabled={settings.moodDropAlerts} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Brain className="w-4 h-4 text-muted-foreground" />
            Cognitive concern alerts
          </div>
          <StatusBadge enabled={settings.cognitiveConcernAlerts} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t border-border/40">
        Delivery: Email
        <span className="text-muted-foreground/60 ml-1">(SMS and Push coming soon)</span>
      </div>
    </div>
  );
}
```

#### Parent Component with Centralized Modal

```tsx
export function AlertSettings({ settings, disabled = false }: AlertSettingsProps) {
  const router = useRouter();
  const [editingEntry, setEditingEntry] = useState<AlertSettingsEntry | null>(null);
  const [editState, setEditState] = useState({
    healthMentionAlerts: true,
    moodDropAlerts: true,
    cognitiveConcernAlerts: true,
  });
  const [initialEditState, setInitialEditState] = useState(editState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEditModal = (line: LineRow, preferences: NotificationPreferencesRow | null) => {
    const defaults = buildDefaults(preferences);
    const state = {
      healthMentionAlerts: defaults.healthMentionAlerts,
      moodDropAlerts: defaults.moodDropAlerts,
      cognitiveConcernAlerts: defaults.cognitiveConcernAlerts,
    };
    setEditState(state);
    setInitialEditState(state);
    setEditingEntry({ line, preferences });
    setError(null);
  };

  const closeEditModal = () => {
    setEditingEntry(null);
    setError(null);
  };

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const firstSwitchRef = useRef<HTMLButtonElement>(null);

  const hasChanges =
    editingEntry !== null &&
    (editState.healthMentionAlerts !== initialEditState.healthMentionAlerts ||
      editState.moodDropAlerts !== initialEditState.moodDropAlerts ||
      editState.cognitiveConcernAlerts !== initialEditState.cognitiveConcernAlerts);

  // Modal-scoped dirty-close guard (NOT useLeavePageGuard)
  const attemptClose = useCallback(() => {
    if (hasChanges && !isSaving) {
      setShowDiscardConfirm(true);
    } else {
      closeEditModal();
    }
  }, [hasChanges, isSaving]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    closeEditModal();
  }, []);

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateNotificationPreferences(editingEntry.line.account_id, editingEntry.line.id, {
        health_mention_alerts: editState.healthMentionAlerts,
        mood_drop_alerts: editState.moodDropAlerts,
        cognitive_concern_alerts: editState.cognitiveConcernAlerts,
      });
      toast.success(`Alert settings updated for ${editingEntry.line.display_name}`);
      closeEditModal();
      router.refresh();
    } catch {
      setError('Failed to update alert settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Alert Settings</h3>
        <p className="text-xs text-muted-foreground">
          Alerts share high-level categories only. Specific details stay private.
        </p>
      </div>

      {/* Cards */}
      {settings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lines available yet.</p>
      ) : (
        <div className="space-y-4">
          {settings.map((entry) => (
            <AlertSettingsCard
              key={entry.line.id}
              line={entry.line}
              preferences={entry.preferences}
              disabled={disabled}
              onEdit={openEditModal}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog
        open={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) attemptClose();
        }}
      >
        <DialogContent
          className="max-w-[468px]"
          overlayClassName="bg-black/50 backdrop-blur-none"
          onInteractOutside={(e) => {
            if (hasChanges && !isSaving) {
              e.preventDefault();
              attemptClose();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasChanges && !isSaving) {
              e.preventDefault();
              attemptClose();
            }
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            firstSwitchRef.current?.focus();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">
                Edit alerts for {editingEntry?.line.display_name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Configure which wellness alerts to receive.
              </DialogDescription>
            </div>
            <button type="button" onClick={attemptClose} className={modalIconButtonClass} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Health mention alerts</p>
                    <p className="text-xs text-muted-foreground">Private summary only.</p>
                  </div>
                </div>
                <Switch
                  ref={firstSwitchRef}
                  checked={editState.healthMentionAlerts}
                  onCheckedChange={(checked) => setEditState((s) => ({ ...s, healthMentionAlerts: checked }))}
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Mood drop alerts</p>
                    <p className="text-xs text-muted-foreground">Triggered by sudden or sustained drops.</p>
                  </div>
                </div>
                <Switch
                  checked={editState.moodDropAlerts}
                  onCheckedChange={(checked) => setEditState((s) => ({ ...s, moodDropAlerts: checked }))}
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Cognitive concern alerts</p>
                    <p className="text-xs text-muted-foreground">Notifies after repeated observations.</p>
                  </div>
                </div>
                <Switch
                  checked={editState.cognitiveConcernAlerts}
                  onCheckedChange={(checked) => setEditState((s) => ({ ...s, cognitiveConcernAlerts: checked }))}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Delivery method:</span> Email
                <span className="text-muted-foreground/60 ml-1">(SMS and Push coming soon)</span>
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={attemptClose} disabled={isSaving} className={modalSecondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className={modalPrimaryButtonClass}>
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes dialog - modal-scoped, NOT useLeavePageGuard */}
      <ConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={(open) => {
          if (!open) cancelDiscard();
        }}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={confirmDiscard}
      />
    </div>
  );
}
```

#### Key Changes from Current Implementation
1. Remove per-card state management (`onDirtyChange`, `onRegisterReset`)
2. Remove per-card save/discard buttons
3. Add centralized edit modal with single entry state
4. Use modal-scoped dirty-close guard (NOT `useLeavePageGuard`)

#### Delivery Method Handling

**Decision**: Delivery method is displayed as **read-only static text** in both the card and modal. The modal does NOT include a dropdown or allow editing this field.

**Behavior**:
- The existing `alert_delivery_method` value is preserved (not sent in update call)
- Only the three boolean alert settings are sent to `updateNotificationPreferences`:

```tsx
await updateNotificationPreferences(editingEntry.line.account_id, editingEntry.line.id, {
  health_mention_alerts: editState.healthMentionAlerts,
  mood_drop_alerts: editState.moodDropAlerts,
  cognitive_concern_alerts: editState.cognitiveConcernAlerts,
  // NOTE: alert_delivery_method is intentionally NOT included
  // It remains unchanged (always 'email' since that's the only option)
});
```

- The read-only text shows: "Delivery method: Email (SMS and Push coming soon)"
- This avoids UI noise from a single-option dropdown while clearly setting user expectations

---

## Priority 5: EditScheduleClient.tsx - Legacy Cleanup

### Context
`ScheduleClient.tsx` already has a fully functional edit modal with URL param support (`?edit=scheduleId`). The standalone `EditScheduleClient.tsx` is redundant and unused.

### Files to Modify

1. **DELETE**: `/src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/EditScheduleClient.tsx`
2. **MODIFY**: `/src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/page.tsx`

### New page.tsx (Validating Redirect)

Replace the existing page.tsx with a minimal redirect that preserves the ownership validation:

```tsx
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getLine } from '~/lib/ultaura/lines';
import { getSchedule } from '~/lib/ultaura/schedules';
import { isUUID } from '~/lib/ultaura/short-id';

export const metadata: Metadata = {
  title: 'Edit Schedule - Ultaura',
};

// NOTE: This codebase uses direct params object, NOT Promise<params>
interface PageProps {
  params: { lineId: string; scheduleId: string };
}

export default async function EditSchedulePage({ params }: PageProps) {
  const [line, schedule] = await Promise.all([
    getLine(params.lineId),
    getSchedule(params.scheduleId),
  ]);

  if (!line || !schedule) {
    notFound();
  }

  // Preserve existing behavior: normalize UUID lineId to short_id
  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/schedule?edit=${params.scheduleId}`);
  }

  // Verify the schedule belongs to this line (ownership guard)
  if (schedule.line_id !== line.id) {
    notFound();
  }

  // Redirect to schedule page with edit modal open
  redirect(`/dashboard/lines/${line.short_id}/schedule?edit=${params.scheduleId}`);
}
```

### Key Behavior
- **Preserves bookmarks**: Old `/schedule/[scheduleId]` URLs redirect to `/schedule?edit=[scheduleId]`
- **Validates ownership**: Schedule must belong to line (returns 404 if not)
- **Normalizes URLs**: UUID lineIds redirect to short_id versions (preserves existing behavior)
- **Server-side only**: No client component needed, just redirect logic
- **Metadata preserved**: Title tag remains for SEO/history

### Files to Delete
- `src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/EditScheduleClient.tsx` - Remove entirely

---

## Testing Checklist

### Manual Testing Per Modal

#### Open/Close Flow (All Modals)
- [ ] Opens via trigger button
- [ ] Closes via X button (routes through dirty check)
- [ ] Closes via Escape key (routes through dirty check)
- [ ] Closes via overlay click (routes through dirty check)
- [ ] Focus trapped within modal
- [ ] First field receives focus on open

#### Dirty State (All Modals)
- [ ] "Unsaved changes" dialog appears when closing with changes
- [ ] "Discard & leave" discards and closes
- [ ] "Stay here" keeps modal open
- [ ] No dialog when closing without changes

#### Form Behavior (Standard Modals: Topics, Invite, Alert Edit)
- [ ] Tab order is logical
- [ ] Enter submits form (except in textareas)
- [ ] Required fields enforced
- [ ] Validation errors displayed clearly
- [ ] Submit button shows loading state
- [ ] Success closes modal and calls `router.refresh()`
- [ ] Error keeps modal open with error message

#### Form Behavior (Vacation Modal - Staging Behavior)
- [ ] Tab order is logical
- [ ] Enter submits form
- [ ] Required fields enforced
- [ ] Validation errors displayed clearly
- [ ] Success shows inline "Added to pending changes" state (modal stays open)
- [ ] "Add another" clears form and returns focus to start date
- [ ] "Done" closes modal
- [ ] **No `router.refresh()` on success** - changes are local until parent Save
- [ ] Error keeps modal open with error message

### Edge Cases Per Modal

#### LineDetailClient Topics
- [ ] Max 5 topics enforcement
- [ ] Duplicate topic prevention (case-insensitive)
- [ ] Custom topics input respects remaining slots
- [ ] Empty topics filtered out
- [ ] Scrollable chip container works

#### VacationSettings
- [ ] Date overlap detection
- [ ] Past dates rejected
- [ ] "Add another" clears form and returns focus
- [ ] "Show past vacations" toggle works
- [ ] Staging behavior preserved (parent save required)

#### PrivacyCenterClient
- [ ] 5-recipient limit enforced with disabled button + tooltip
- [ ] Phone required when "emergency contact" checked
- [ ] Phone format validation ("Enter a valid US phone number")
- [ ] Reinvite confirmation for unsubscribed emails
- [ ] Recipient count updates after successful invite

#### AlertSettings
- [ ] Read-only cards display correct status badges
- [ ] Per-line edit opens correct modal
- [ ] Delivery method shown as static text
- [ ] Multiple lines can be edited (one at a time)

#### EditScheduleClient Redirect
- [ ] Old URLs redirect correctly
- [ ] Invalid schedule IDs return 404
- [ ] Schedules not belonging to line return 404
- [ ] UUID lineIds normalize to short_ids

### Accessibility
- [ ] Focus trap works within modal
- [ ] Escape key closes/confirms appropriately
- [ ] ARIA labels on close buttons (`aria-label="Close"`)
- [ ] Screen reader announces errors
- [ ] Color contrast meets WCAG AA for badges

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx` | Modify | Extract Topics form to modal, add trigger button |
| `src/app/dashboard/(app)/lines/[lineId]/settings/VacationSettings.tsx` | Modify | Extract Add form to modal, add "Show past" toggle, add empty state CTA |
| `src/app/dashboard/(app)/privacy/PrivacyCenterClient.tsx` | Modify | Extract Invite form to modal, add limit handling with tooltip |
| `src/app/dashboard/(app)/alerts/AlertSettings.tsx` | Modify | Convert to read-only cards + centralized edit modal per line |
| `src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/EditScheduleClient.tsx` | Delete | Remove legacy component |
| `src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/page.tsx` | Modify | Convert to validating redirect to `/schedule?edit=scheduleId` |

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/(app)/lines/[lineId]/milestones/MilestonesClient.tsx` | Reference for modal structure (note: does NOT implement dirty-close guard) |
| `src/app/dashboard/(app)/lines/[lineId]/contacts/ContactsClient.tsx` | Reference for add modal structure (note: does NOT implement dirty-close guard) |
| `src/core/ui/modal-button-classes.ts` | Button class constants |
| `src/core/ui/Dialog.tsx` | Radix-based Dialog component |
| `src/core/ui/Tooltip.tsx` | Tooltip component for disabled button hints |
| `src/core/ui/ConfirmationDialog.tsx` | Reusable confirmation dialog |
| `src/core/hooks/use-leave-page-guard.ts` | Page navigation guard (NOT for modal close - see spec notes) |

---

## Assumptions

1. The `Dialog` component from `~/core/ui/Dialog` supports `overlayClassName` prop for custom overlay styling
2. The `DialogContent` component passes through Radix props (`onInteractOutside`, `onEscapeKeyDown`, `onOpenAutoFocus`) to the underlying primitive
3. Existing server actions (`updateLine`, `addVacationRange`, `inviteNotificationRecipient`, `updateNotificationPreferences`) remain unchanged
4. The `isUUID` helper exists in `~/lib/ultaura/short-id` for URL normalization
5. All form state reset logic will be implemented to clear errors and return to initial values
6. The `Tooltip`, `TooltipTrigger`, and `TooltipContent` components from `~/core/ui/Tooltip` work as documented

## Important Clarifications

### useLeavePageGuard vs Modal Dirty-Close

**`useLeavePageGuard`** guards:
- Browser `beforeunload` events (closing tab, refreshing page)
- Client-side navigation via Next.js router or anchor clicks

**`useLeavePageGuard` does NOT guard**:
- Modal close via overlay click
- Modal close via Escape key
- Modal close via X button click
- `onOpenChange` callback when dialog state changes

For modal dirty-close protection, use the [Modal Dirty-Close Guard Pattern](#modal-dirty-close-guard-pattern) with:
- `onInteractOutside` (intercept overlay click)
- `onEscapeKeyDown` (intercept Escape key)
- `onOpenChange` gate (intercept programmatic close)
- Modal-scoped `showDiscardConfirm` state + `ConfirmationDialog`
