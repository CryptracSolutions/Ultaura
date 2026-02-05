'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Brain, Activity, Edit2, X } from 'lucide-react';
import { Switch } from '~/core/ui/Switch';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import type { LineRow, NotificationPreferencesRow } from '~/lib/ultaura/types';
import { updateNotificationPreferences } from '~/lib/ultaura/insights';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
} from '~/core/ui/modal-button-classes';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';
import { useRouter } from 'next/navigation';

interface AlertSettingsEntry {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
}

interface AlertSettingsProps {
  settings: AlertSettingsEntry[];
  disabled?: boolean;
}

function buildDefaults(preferences: NotificationPreferencesRow | null) {
  return {
    healthMentionAlerts: preferences?.health_mention_alerts ?? true,
    moodDropAlerts: preferences?.mood_drop_alerts ?? true,
    cognitiveConcernAlerts: preferences?.cognitive_concern_alerts ?? true,
  };
}

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
        {!disabled ? (
          <button
            type="button"
            onClick={() => onEdit(line, preferences)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Edit2 className="w-5 h-5" />
            Edit
          </button>
        ) : null}
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const firstSwitchRef = useRef<HTMLButtonElement>(null);

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

  const closeEditModal = useCallback(() => {
    setEditingEntry(null);
    setError(null);
  }, []);

  const hasChanges =
    editingEntry !== null &&
    (editState.healthMentionAlerts !== initialEditState.healthMentionAlerts ||
      editState.moodDropAlerts !== initialEditState.moodDropAlerts ||
      editState.cognitiveConcernAlerts !== initialEditState.cognitiveConcernAlerts);

  const attemptClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      closeEditModal();
    }
  }, [closeEditModal, hasChanges, isSaving]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    closeEditModal();
  }, [closeEditModal]);

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <div>
        <h3 className="text-sm font-semibold text-foreground">Alert Settings</h3>
        <p className="text-xs text-muted-foreground">
          Alerts share high-level categories only. Specific details stay private.
        </p>
      </div>

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

      <Dialog
        open={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (isSaving) return;
            attemptClose();
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
          onInteractOutside={(event) => {
            if (isSaving || hasChanges) {
              event.preventDefault();
              attemptClose();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (isSaving || hasChanges) {
              event.preventDefault();
              attemptClose();
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
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
            <button
              type="button"
              onClick={attemptClose}
              disabled={isSaving}
              className={modalIconButtonClass}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
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
                  onCheckedChange={(checked) =>
                    setEditState((state) => ({ ...state, healthMentionAlerts: checked }))
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Mood drop alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Triggered by sudden or sustained drops.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editState.moodDropAlerts}
                  onCheckedChange={(checked) =>
                    setEditState((state) => ({ ...state, moodDropAlerts: checked }))
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Cognitive concern alerts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Notifies after repeated observations.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={editState.cognitiveConcernAlerts}
                  onCheckedChange={(checked) =>
                    setEditState((state) => ({ ...state, cognitiveConcernAlerts: checked }))
                  }
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
              <button
                type="button"
                onClick={attemptClose}
                disabled={isSaving}
                className={COMPACT_OUTLINE_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={COMPACT_PRIMARY_BUTTON_CLASS}
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
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
