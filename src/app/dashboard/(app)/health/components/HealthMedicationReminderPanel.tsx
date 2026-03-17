'use client';

import { useState, useEffect, useTransition } from 'react';
import { Bell, Play, X, Plus } from 'lucide-react';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
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

const PAUSE_SOURCE_LABELS: Record<PauseSource, string> = {
  manual: 'Manually paused',
  health_manual_resume_required: 'Waiting for manual resume',
  health_consent_not_requested: 'Health consent not yet requested',
  health_consent_denied: 'Health consent denied',
  health_consent_revoked: 'Health consent revoked',
  health_plan_ineligible: 'Current plan does not include health reminders',
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

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-foreground">Call Reminders</h4>
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
      <p className="text-xs text-muted-foreground">
        Health-linked reminders are call-only. They are not delivered by SMS.
      </p>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-md border border-border bg-background p-3 space-y-3">
          <p className="text-sm font-medium text-foreground">New reminder</p>

          <div className="space-y-1">
            <label htmlFor="reminder-time" className="text-xs font-medium text-muted-foreground">
              Time (HH:MM)
            </label>
            <TextField.Input
              id="reminder-time"
              type="time"
              value={newTimeOfDay}
              onChange={(e) => setNewTimeOfDay(e.target.value)}
              aria-label="Reminder time"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="reminder-label" className="text-xs font-medium text-muted-foreground">
              Label (optional)
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

          <div className="flex gap-2">
            <Button
              variant="default"
              size="small"
              onClick={handleAdd}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save reminder'}
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={() => { setShowAddForm(false); setAddError(null); }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Loading / error states */}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading reminders…
        </div>
      )}

      {!loading && loadError && (
        <p className="text-xs text-destructive" role="alert">{loadError}</p>
      )}

      {!loading && !loadError && activeReminders.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No reminders yet. Add one above.</p>
      )}

      {/* Reminder list */}
      {!loading && !loadError && activeReminders.length > 0 && (
        <ul className="space-y-2" aria-label={`Reminders for ${medicationName}`}>
          {activeReminders.map((reminder) => {
            const needsResume = reminder.pauseSources.includes('health_manual_resume_required');
            const otherSources = reminder.pauseSources.filter((s) => s !== 'health_manual_resume_required');

            return (
              <li
                key={reminder.reminderId}
                className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {formatTime(reminder.timeOfDay)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reminder.isActive ? 'Active' : 'Paused'}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => handleCancel(reminder.reminderId)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Cancel reminder at ${formatTime(reminder.timeOfDay)}`}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>

                {/* Pause source explanations */}
                {otherSources.length > 0 && (
                  <ul className="space-y-0.5" aria-label="Pause reasons">
                    {otherSources.map((source) => (
                      <li key={source} className="text-xs text-amber-600 dark:text-amber-400">
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
                    Resume reminder
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
