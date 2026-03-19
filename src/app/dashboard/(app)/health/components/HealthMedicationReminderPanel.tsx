'use client';

import { useState, useEffect, useTransition } from 'react';
import { Play, Pause, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import { TimePicker } from '~/core/ui/TimePicker';
import {
  createHealthReminderAction,
  getHealthRemindersForMedicationAction,
  resumeHealthReminderAction,
  pauseHealthReminderAction,
  cancelHealthReminderAction,
} from '~/lib/ultaura/health/actions';

type PauseSource =
  | 'manual'
  | 'health_manual_resume_required'
  | 'health_consent_not_requested'
  | 'health_consent_denied'
  | 'health_consent_revoked'
  | 'health_plan_ineligible';

type HealthLinkedReminder = {
  linkId: string;
  reminderId: string;
  timeOfDay: string | null;
  status: string;
  isActive: boolean;
  pauseSources: PauseSource[];
  createdAt: string;
};

interface HealthMedicationReminderPanelProps {
  medicationId: string;
  lineId: string;
  accountId: string;
  medicationName: string;
}

const CONSENT_SOURCES: PauseSource[] = [
  'health_consent_not_requested',
  'health_consent_denied',
  'health_consent_revoked',
];

function isConsentPaused(sources: PauseSource[]): boolean {
  return sources.some((s) => CONSENT_SOURCES.includes(s));
}

const PAUSE_SOURCE_LABELS: Record<PauseSource, string> = {
  manual: 'Manually paused',
  health_manual_resume_required: 'Needs manual resume',
  health_consent_not_requested: 'Activates once your loved one consents to health info during calls',
  health_consent_denied: 'Your loved one has not consented to health info during calls',
  health_consent_revoked: 'Your loved one revoked consent for health info during calls',
  health_plan_ineligible: 'Current plan does not include medication reminders',
};

const HEALTH_REMINDER_LIMIT = 8;

function formatTime(timeOfDay: string | null): string {
  if (!timeOfDay) return 'Unknown time';
  const [h, m] = timeOfDay.split(':');
  const hours = parseInt(h ?? '0', 10);
  const minutes = m ?? '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

export function HealthMedicationReminderPanel({
  medicationId,
  lineId,
  accountId: _accountId,
  medicationName,
}: HealthMedicationReminderPanelProps) {
  const [reminders, setReminders] = useState<HealthLinkedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTimeOfDay, setNewTimeOfDay] = useState('08:00');
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadReminders() {
    setLoading(true);
    setLoadError(null);
    const result = await getHealthRemindersForMedicationAction(medicationId, lineId);
    if (result.success) {
      setReminders(result.reminders as HealthLinkedReminder[]);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicationId, lineId]);

  function isTooCloseToExisting(time: string): boolean {
    const [h, m] = time.split(':').map(Number);
    const newMinutes = (h ?? 0) * 60 + (m ?? 0);
    return activeReminders.some((r) => {
      if (!r.timeOfDay) return false;
      const [rh, rm] = r.timeOfDay.split(':').map(Number);
      const existingMinutes = (rh ?? 0) * 60 + (rm ?? 0);
      const diff = Math.abs(newMinutes - existingMinutes);
      const wrappedDiff = Math.min(diff, 1440 - diff); // handle midnight wrap
      return wrappedDiff < 5;
    });
  }

  function handleAdd() {
    setAddError(null);
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(newTimeOfDay)) {
      setAddError('Please enter a valid time in HH:MM format.');
      return;
    }
    if (isTooCloseToExisting(newTimeOfDay)) {
      setAddError('A reminder already exists within 5 minutes of this time. Choose a different time.');
      return;
    }
    startTransition(async () => {
      const result = await createHealthReminderAction(
        medicationId,
        lineId,
        newTimeOfDay,
      );
      if (result.success) {
        toast.success('Reminder created');
        setShowAddForm(false);
        setNewTimeOfDay('08:00');
        await loadReminders();
      } else {
        setAddError(result.error);
      }
    });
  }

  function handleResume(reminderId: string) {
    startTransition(async () => {
      const result = await resumeHealthReminderAction(reminderId, lineId);
      if (result.success) {
        toast.success('Reminder resumed');
        await loadReminders();
      } else {
        toast.error(result.error ?? 'Failed to resume reminder');
      }
    });
  }

  function handlePause(reminderId: string) {
    startTransition(async () => {
      const result = await pauseHealthReminderAction(reminderId, lineId);
      if (result.success) {
        toast.success('Reminder paused');
        await loadReminders();
      } else {
        toast.error(result.error ?? 'Failed to pause reminder');
      }
    });
  }

  function handleCancel(reminderId: string) {
    startTransition(async () => {
      const result = await cancelHealthReminderAction(reminderId, lineId);
      if (result.success) {
        toast.success('Reminder removed');
        setReminders((prev) => prev.filter((r) => r.reminderId !== reminderId));
      } else {
        toast.error('Failed to remove reminder');
      }
    });
  }

  const activeReminders = reminders.filter((r) => r.status !== 'canceled');
  const activeCount = activeReminders.filter((r) => r.isActive).length;
  const remaining = HEALTH_REMINDER_LIMIT - activeReminders.length;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
      {/* Header + count */}
      <div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Medication Reminders</h4>
          {!loading && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCount} active · {remaining} remaining
            </p>
          )}
          <p className="mt-1 text-xs text-primary/70">
            Managed separately from your regular reminders. Delivered during calls only.
          </p>
        </div>
      </div>

      {!loading && !loadError && activeReminders.length > 0 && !showAddForm && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="small"
            className="w-full sm:w-auto"
            onClick={() => setShowAddForm((v) => !v)}
            disabled={isPending}
            aria-label={`Add reminder for ${medicationName}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add reminder
          </Button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">New reminder</p>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Reminder time
            </label>
            <TimePicker
              value={newTimeOfDay}
              onChange={setNewTimeOfDay}
              placeholder="Select time"
            />
          </div>

          {addError && (
            <p className="text-xs text-destructive" role="alert">{addError}</p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="small"
              className="w-full sm:w-auto"
              onClick={() => { setShowAddForm(false); setAddError(null); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="small"
              className="w-full sm:w-auto"
              onClick={handleAdd}
              disabled={isPending}
            >
              {isPending ? 'Creating…' : 'Create reminder'}
            </Button>
          </div>
        </div>
      )}

      {/* Loading / error states */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading reminders…
        </div>
      )}

      {!loading && loadError && (
        <p className="text-xs text-destructive" role="alert">{loadError}</p>
      )}

      {!loading && !loadError && activeReminders.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <p className="text-xs text-muted-foreground">No reminders yet</p>
          <Button
            variant="outline"
            size="small"
            className="w-full sm:w-auto"
            onClick={() => setShowAddForm((v) => !v)}
            disabled={isPending}
            aria-label={`Add reminder for ${medicationName}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add reminder
          </Button>
        </div>
      )}

      {/* Reminder list */}
      {!loading && !loadError && activeReminders.length > 0 && (
        <ul className="space-y-2" aria-label={`Reminders for ${medicationName}`}>
          {activeReminders.map((reminder) => {
            const consentPaused = isConsentPaused(reminder.pauseSources);
            const manuallyPaused = reminder.pauseSources.includes('manual');
            const pauseExplanations = reminder.pauseSources.filter(
              (s) => s !== 'manual' && s !== 'health_manual_resume_required',
            );

            // Determine status label and style
            let statusLabel = 'Active';
            let statusClasses = 'bg-primary/10 text-primary';
            if (!reminder.isActive) {
              if (consentPaused) {
                statusLabel = 'Pending consent';
                statusClasses = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
              } else {
                statusLabel = 'Paused';
                statusClasses = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
              }
            }

            return (
              <li
                key={reminder.reminderId}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="shrink-0 text-sm font-medium text-foreground">
                      {formatTime(reminder.timeOfDay)}
                    </p>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Pause/Resume toggle — only show for non-consent-paused reminders */}
                    {!consentPaused && (
                      reminder.isActive ? (
                        <button
                          onClick={() => handlePause(reminder.reminderId)}
                          disabled={isPending}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                          aria-label={`Pause reminder at ${formatTime(reminder.timeOfDay)}`}
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResume(reminder.reminderId)}
                          disabled={isPending}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                          aria-label={`Resume reminder at ${formatTime(reminder.timeOfDay)}`}
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )
                    )}

                    <button
                      onClick={() => handleCancel(reminder.reminderId)}
                      disabled={isPending}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      aria-label={`Remove reminder at ${formatTime(reminder.timeOfDay)}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Pause source explanations */}
                {pauseExplanations.length > 0 && (
                  <ul className="space-y-0.5" aria-label="Pause reasons">
                    {pauseExplanations.map((source) => (
                      <li key={source} className={`text-xs ${consentPaused ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {PAUSE_SOURCE_LABELS[source] ?? source}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
