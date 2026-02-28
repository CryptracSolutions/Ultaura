'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, Plus, User } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import {
  cancelReminder,
  skipNextOccurrence,
  pauseReminder,
  resumeReminder,
  snoozeReminder,
} from '~/lib/ultaura/reminders';
import { SNOOZE_OPTIONS } from '~/lib/ultaura/reminder-utils';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { AddReminderModal } from '~/components/ultaura/AddReminderModal';
import Button from '~/core/ui/Button';
import { ReminderLineFilter } from './components/ReminderLineFilter';
import { ReminderCard } from './components/ReminderCard';
import type { ReminderCardReminder } from './components/ReminderCard';
import { EditReminderModal } from './components/EditReminderModal';
import { ReminderActivity } from './components/ReminderActivity';

type Reminder = ReminderCardReminder;

interface RemindersPageClientProps {
  lines: LineRow[];
  reminders: Reminder[];
  disabled?: boolean;
  reminderLimits: Record<string, { limit: number | null; count: number }>;
}

export function RemindersPageClient({
  lines,
  reminders,
  disabled = false,
  reminderLimits,
}: RemindersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven state
  const selectedLineShortId = searchParams.get('line') ?? null;
  const editReminderIdParam = searchParams.get('edit') ?? null;

  // Modal / loading state
  const [showAddModal, setShowAddModal] = useState(false);
  const [reminderToCancel, setReminderToCancel] = useState<string | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  // Deep-link: open edit modal from ?edit= param, then clean URL
  const handledEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (disabled || !editReminderIdParam) {
      handledEditIdRef.current = null;
      return;
    }
    if (handledEditIdRef.current === editReminderIdParam) return;
    handledEditIdRef.current = editReminderIdParam;

    const reminder = reminders.find((r) => r.reminderId === editReminderIdParam);
    if (reminder) setEditingReminder(reminder);

    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const query = next.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  }, [disabled, editReminderIdParam, reminders, router, searchParams]);

  // Derived data
  const selectedLine = selectedLineShortId
    ? lines.find((l) => l.short_id === selectedLineShortId) ?? null
    : null;

  const filteredReminders = selectedLine
    ? reminders.filter((r) => r.lineId === selectedLine.id)
    : reminders;

  const scheduledReminders = filteredReminders.filter((r) => r.status === 'scheduled');
  const pastReminders = filteredReminders.filter((r) => r.status !== 'scheduled');

  const linesForModal = lines.map((line) => ({
    id: line.id,
    displayName: line.display_name,
    timezone: line.timezone,
    phoneE164: line.phone_e164,
  }));

  const preselectedLineId = selectedLine?.id ?? null;

  const selectedLineLimits = selectedLine ? reminderLimits[selectedLine.id] : null;
  const isAtLimit =
    selectedLineLimits != null &&
    selectedLineLimits.limit != null &&
    selectedLineLimits.count >= selectedLineLimits.limit;
  const isSelectedLineUnverified = selectedLine ? !selectedLine.phone_verified_at : false;
  const isSetReminderDisabled = selectedLine ? (isAtLimit || isSelectedLineUnverified) : false;

  // Group reminders by line (All Lines view)
  const remindersByLine = reminders.reduce<Record<string, Reminder[]>>((acc, r) => {
    if (!acc[r.lineId]) acc[r.lineId] = [];
    acc[r.lineId].push(r);
    return acc;
  }, {});

  // Line filter data
  const lineFilterData = lines.map((l) => ({
    short_id: l.short_id,
    display_name: l.display_name,
  }));

  // -- Helpers --

  function setLoading(reminderId: string, value: boolean) {
    setLoadingActions((prev) => ({ ...prev, [reminderId]: value }));
  }

  function findLineShortId(reminderId: string): string {
    return reminders.find((r) => r.reminderId === reminderId)?.lineShortId ?? '';
  }

  async function runReminderAction(
    reminderId: string,
    run: () => Promise<{ success: boolean; error?: { message?: string } }>,
    successMessage: string,
    fallbackErrorMessage: string,
  ): Promise<boolean> {
    if (disabled) return false;

    setLoading(reminderId, true);
    const result = await run();
    setLoading(reminderId, false);

    if (result.success) {
      toast.success(successMessage);
      router.refresh();
      return true;
    }

    toast.error(result.error?.message || fallbackErrorMessage);
    return false;
  }

  // -- Action handlers --

  const handlePause = async (reminderId: string) => {
    await runReminderAction(
      reminderId,
      () => pauseReminder(reminderId, findLineShortId(reminderId)),
      'Reminder paused',
      'Failed to pause reminder',
    );
  };

  const handleResume = async (reminderId: string) => {
    await runReminderAction(
      reminderId,
      () => resumeReminder(reminderId, findLineShortId(reminderId)),
      'Reminder resumed',
      'Failed to resume reminder',
    );
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    const option = SNOOZE_OPTIONS.find((o) => o.value === minutes);
    await runReminderAction(
      reminderId,
      () => snoozeReminder(reminderId, minutes, findLineShortId(reminderId)),
      `Snoozed for ${option?.label || `${minutes} minutes`}`,
      'Failed to snooze reminder',
    );
  };

  const handleSkip = async (reminderId: string) => {
    await runReminderAction(
      reminderId,
      () => skipNextOccurrence(reminderId, findLineShortId(reminderId)),
      'Next occurrence skipped',
      'Failed to skip reminder',
    );
  };

  const handleConfirmCancel = async () => {
    if (!reminderToCancel || disabled) return;
    const succeeded = await runReminderAction(
      reminderToCancel,
      () => cancelReminder(reminderToCancel, findLineShortId(reminderToCancel)),
      'Reminder canceled',
      'Failed to cancel reminder',
    );

    if (!succeeded) {
      throw new Error('Cancel failed');
    }
  };

  const handleEdit = (reminder: Reminder) => {
    if (disabled) return;
    setEditingReminder(reminder);
  };

  // Shared action props for ReminderCard
  const cardActions = {
    onEdit: handleEdit,
    onPause: handlePause,
    onResume: handleResume,
    onSnooze: handleSnooze,
    onSkip: handleSkip,
    onCancel: (reminderId: string) => setReminderToCancel(reminderId),
  };

  // -- No lines state --
  if (lines.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">No phone lines yet</h2>
        <p className="text-muted-foreground mb-4">
          Add a phone line first, then you can set up reminders.
        </p>
        {!disabled && (
          <Button variant="default" size="small" href="/dashboard/lines?action=add" block>
            <Plus className="w-4 h-4" />
            Add a Phone Line
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top bar: CTA + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!disabled && (
          <div className="space-y-1">
            <Button
              variant="default"
              size="small"
              onClick={() => setShowAddModal(true)}
              disabled={isSetReminderDisabled}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Set Reminder
            </Button>
            {isSelectedLineUnverified && (
              <p className="text-xs text-muted-foreground">Verify phone to add reminders</p>
            )}
          </div>
        )}
        {lines.length > 1 && (
          <div className="w-full sm:w-[16rem] sm:ml-auto rounded-xl ring-2 ring-primary">
            <ReminderLineFilter
              lines={lineFilterData}
              currentLineShortId={selectedLineShortId}
            />
          </div>
        )}
      </div>

      {/* ---- All Lines view ---- */}
      {!selectedLine && (
        <div className="space-y-6">
          {lines.map((line) => {
            const lineReminders = remindersByLine[line.id] || [];
            const lineScheduled = lineReminders.filter((r) => r.status === 'scheduled');
            const linePast = lineReminders.filter((r) => r.status !== 'scheduled');
            const lineLimits = reminderLimits[line.id];
            const activeCount = lineLimits?.count ?? lineScheduled.length;
            const allowedText = lineLimits?.limit == null ? 'Unlimited' : `${lineLimits.limit} allowed`;
            const isLineUnverified = !line.phone_verified_at;
            const isLineAtLimit =
              lineLimits?.limit != null &&
              activeCount >= lineLimits.limit;

            return (
              <div key={line.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Line header */}
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {line.display_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {activeCount} active reminders
                  </p>
                  {allowedText ? (
                    <p className="text-xs text-muted-foreground">
                      {allowedText}
                    </p>
                  ) : null}
                </div>

                <div className="divide-y divide-border">
                  {lineReminders.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No reminders set up yet</p>
                      {!disabled && (
                        <div className="mt-2">
                          <Button
                            variant="default"
                            size="small"
                            onClick={() => setShowAddModal(true)}
                            disabled={isLineUnverified || isLineAtLimit}
                          >
                            <Plus className="w-4 h-4" />
                            Create your first reminder
                          </Button>
                          {isLineUnverified && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Verify phone to add reminders
                            </p>
                          )}
                          {!isLineUnverified && isLineAtLimit && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Reminder limit reached for this line
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {lineScheduled.map((reminder) => (
                        <ReminderCard
                          key={reminder.reminderId}
                          reminder={reminder}
                          disabled={disabled}
                          loading={!!loadingActions[reminder.reminderId]}
                          {...cardActions}
                        />
                      ))}
                      {linePast.length > 0 && lineScheduled.length > 0 && (
                        <div className="px-6 py-2 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Past</p>
                        </div>
                      )}
                      {linePast.slice(0, 5).map((reminder) => (
                        <ReminderCard
                          key={reminder.reminderId}
                          reminder={reminder}
                          disabled
                          {...cardActions}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Single line view ---- */}
      {selectedLine && (
        <div className="space-y-6">
          {/* Upcoming */}
          {scheduledReminders.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3">Upcoming Reminders</h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
                {scheduledReminders.map((reminder) => (
                  <ReminderCard
                    key={reminder.reminderId}
                    reminder={reminder}
                    disabled={disabled}
                    loading={!!loadingActions[reminder.reminderId]}
                    {...cardActions}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastReminders.length > 0 && (
            <PastRemindersSection reminders={pastReminders} cardActions={cardActions} />
          )}

          {/* Empty */}
          {filteredReminders.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No reminders for {selectedLine.display_name}</p>
              {!disabled && (
                <div className="mt-3">
                  <Button
                    variant="default"
                    size="small"
                    onClick={() => setShowAddModal(true)}
                    disabled={isAtLimit || isSelectedLineUnverified}
                  >
                    <Plus className="w-4 h-4" />
                    Create First Reminder
                  </Button>
                  {isSelectedLineUnverified && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verify phone to add reminders
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reminder activity */}
          {filteredReminders.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-4">Reminder Activity</h2>
              <ReminderActivity lineId={selectedLine.id} />
            </div>
          )}
        </div>
      )}

      {/* Cancel confirmation */}
      <ConfirmationDialog
        open={reminderToCancel !== null}
        onOpenChange={(open) => !open && setReminderToCancel(null)}
        title="Cancel Reminder"
        description="Are you sure you want to cancel this reminder?"
        confirmLabel="Cancel Reminder"
        variant="destructive"
        onConfirm={handleConfirmCancel}
      />

      {/* Edit modal */}
      <EditReminderModal
        reminder={
          editingReminder
            ? {
                reminderId: editingReminder.reminderId,
                message: editingReminder.message,
                dueAt: editingReminder.dueAt,
                timezone: editingReminder.timezone,
                isRecurring: editingReminder.isRecurring,
                lineShortId: editingReminder.lineShortId,
                deliveryMethod: editingReminder.deliveryMethod,
              }
            : null
        }
        lineDisplayName={editingReminder?.displayName ?? ''}
        onClose={() => setEditingReminder(null)}
      />

      {/* Add modal */}
      <AddReminderModal
        open={showAddModal}
        onOpenChange={(open) => !open && setShowAddModal(false)}
        lines={linesForModal}
        preselectedLineId={preselectedLineId}
      />
    </div>
  );
}

// Expandable past reminders list
function PastRemindersSection({
  reminders,
  cardActions,
}: {
  reminders: Reminder[];
  cardActions: {
    onEdit: (reminder: Reminder) => void;
    onPause: (reminderId: string) => void;
    onResume: (reminderId: string) => void;
    onSnooze: (reminderId: string, minutes: number) => void;
    onSkip: (reminderId: string) => void;
    onCancel: (reminderId: string) => void;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const displayed = expanded ? reminders : reminders.slice(0, 5);
  const hasMore = reminders.length > 5;

  return (
    <div>
      <h2 className="font-semibold text-lg mb-3">Past Reminders</h2>
      <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
        {displayed.map((reminder) => (
          <ReminderCard
            key={reminder.reminderId}
            reminder={reminder}
            disabled
            {...cardActions}
          />
        ))}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-6 py-3 text-sm text-primary hover:underline text-center"
          >
            {expanded ? 'Show less' : `View all ${reminders.length} past reminders`}
          </button>
        )}
      </div>
    </div>
  );
}
