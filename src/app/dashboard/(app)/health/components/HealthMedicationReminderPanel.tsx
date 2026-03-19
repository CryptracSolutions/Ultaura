'use client';

import { useState, useEffect, useTransition } from 'react';
import { Play, X, Plus } from 'lucide-react';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import { TimePicker } from '~/core/ui/TimePicker';
import {
  createHealthReminderAction,
  getHealthRemindersForMedicationAction,
  resumeHealthReminderAction,
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
  label: string | null;
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
  const [newLabel, setNewLabel] = useState('');
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

  function handleAdd() {
    setAddError(null);
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(newTimeOfDay)) {
      setAddError('Please enter a valid time in HH:MM format.');
      return;
    }
    startTransition(async () => {
      const result = await createHealthReminderAction(
        medicationId,
        lineId,
        newTimeOfDay,
        newLabel.trim() || undefined,
      );
      if (result.success) {
        setShowAddForm(false);
        setNewTimeOfDay('08:00');
        setNewLabel('');
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
        await loadReminders();
      }
    });
  }

  function handleCancel(reminderId: string) {
    startTransition(async () => {
      const result = await cancelHealthReminderAction(reminderId, lineId);
      if (result.success) {
        setReminders((prev) => prev.filter((r) => r.reminderId !== reminderId));
      }
    });
  }

  const activeReminders = reminders.filter((r) => r.status !== 'canceled');
  const activeCount = activeReminders.filter((r) => r.isActive).length;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">Medication Reminders</h4>
          {!loading && activeReminders.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {activeCount} active
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="small"
          onClick={() => setShowAddForm((v) => !v)}
          disabled={isPending}
          aria-label={`Add reminder for ${medicationName}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Add reminder
        </Button>
      </div>

      {/* Informational note */}
      <p className="text-xs text-primary/70">
        Medication reminders are managed here, separate from your regular reminders. They are delivered during calls only.
      </p>

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

          <div className="space-y-1.5">
            <label htmlFor="reminder-label" className="block text-xs font-medium text-muted-foreground">
              Label <span className="font-normal text-muted-foreground/70">(optional)</span>
            </label>
            <TextField.Input
              id="reminder-label"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`${medicationName} reminder`}
              maxLength={120}
              aria-label="Reminder label"
            />
          </div>

          {addError && (
            <p className="text-xs text-destructive" role="alert">{addError}</p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
              {isPending ? 'Saving…' : 'Save reminder'}
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

      {!loading && !loadError && activeReminders.length === 0 && (
        <p className="text-xs text-muted-foreground py-3 text-center">No reminders yet</p>
      )}

      {/* Reminder list */}
      {!loading && !loadError && activeReminders.length > 0 && (
        <ul className="space-y-2" aria-label={`Reminders for ${medicationName}`}>
          {activeReminders.map((reminder) => {
            const needsResume = reminder.pauseSources.includes('health_manual_resume_required');
            const consentPaused = isConsentPaused(reminder.pauseSources);
            const otherSources = reminder.pauseSources.filter((s) => s !== 'health_manual_resume_required');

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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {formatTime(reminder.timeOfDay)}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {reminder.label && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{reminder.label}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleCancel(reminder.reminderId)}
                    disabled={isPending}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
                    aria-label={`Cancel reminder at ${formatTime(reminder.timeOfDay)}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Pause source explanations */}
                {otherSources.length > 0 && (
                  <ul className="space-y-0.5" aria-label="Pause reasons">
                    {otherSources.map((source) => (
                      <li key={source} className={`text-xs ${consentPaused ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {PAUSE_SOURCE_LABELS[source] ?? source}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Resume button */}
                {needsResume && (
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => handleResume(reminder.reminderId)}
                    disabled={isPending}
                    className="self-start"
                    aria-label={`Resume reminder at ${formatTime(reminder.timeOfDay)}`}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
