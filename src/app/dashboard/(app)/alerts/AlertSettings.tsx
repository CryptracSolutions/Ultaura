'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, Brain, Activity } from 'lucide-react';
import { Switch } from '~/core/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import Button from '~/core/ui/Button';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import type { LineRow, NotificationPreferencesRow } from '~/lib/ultaura/types';
import { updateNotificationPreferences } from '~/lib/ultaura/insights';

interface AlertSettingsEntry {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
}

interface AlertSettingsProps {
  settings: AlertSettingsEntry[];
  disabled?: boolean;
}

const DELIVERY_OPTIONS = [
  { value: 'email', label: 'Email' },
] as const;

function buildDefaults(preferences: NotificationPreferencesRow | null) {
  const rawDelivery = preferences?.alert_delivery_method ?? 'email';
  const deliveryMethod = DELIVERY_OPTIONS.some((option) => option.value === rawDelivery)
    ? rawDelivery
    : 'email';

  return {
    healthMentionAlerts: preferences?.health_mention_alerts ?? true,
    moodDropAlerts: preferences?.mood_drop_alerts ?? true,
    cognitiveConcernAlerts: preferences?.cognitive_concern_alerts ?? true,
    deliveryMethod,
  };
}

function AlertSettingsCard({
  line,
  preferences,
  onDirtyChange,
  onRegisterReset,
  disabled = false,
}: {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterReset?: (handler: () => void) => void;
  disabled?: boolean;
}) {
  const defaults = useMemo(() => buildDefaults(preferences), [preferences]);
  const [healthMentionAlerts, setHealthMentionAlerts] = useState(defaults.healthMentionAlerts);
  const [moodDropAlerts, setMoodDropAlerts] = useState(defaults.moodDropAlerts);
  const [cognitiveConcernAlerts, setCognitiveConcernAlerts] = useState(defaults.cognitiveConcernAlerts);
  const [deliveryMethod, setDeliveryMethod] = useState(defaults.deliveryMethod);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDefaults, setSavedDefaults] = useState(defaults);

  const hasChanges =
    healthMentionAlerts !== savedDefaults.healthMentionAlerts ||
    moodDropAlerts !== savedDefaults.moodDropAlerts ||
    cognitiveConcernAlerts !== savedDefaults.cognitiveConcernAlerts ||
    deliveryMethod !== savedDefaults.deliveryMethod;

  const resetForm = useCallback(() => {
    setHealthMentionAlerts(savedDefaults.healthMentionAlerts);
    setMoodDropAlerts(savedDefaults.moodDropAlerts);
    setCognitiveConcernAlerts(savedDefaults.cognitiveConcernAlerts);
    setDeliveryMethod(savedDefaults.deliveryMethod);
  }, [savedDefaults]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  useEffect(() => {
    onRegisterReset?.(resetForm);
  }, [onRegisterReset, resetForm]);

  const handleSave = async () => {
    if (disabled || !hasChanges) return;
    setIsSaving(true);

    try {
      await updateNotificationPreferences(line.account_id, line.id, {
        health_mention_alerts: healthMentionAlerts,
        mood_drop_alerts: moodDropAlerts,
        cognitive_concern_alerts: cognitiveConcernAlerts,
        alert_delivery_method: deliveryMethod,
      });
      const nextDefaults = {
        healthMentionAlerts,
        moodDropAlerts,
        cognitiveConcernAlerts,
        deliveryMethod,
      };
      setSavedDefaults(nextDefaults);
      toast.success(`Alert settings updated for ${line.display_name}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update alert settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{line.display_name}</p>
        <p className="text-xs text-muted-foreground">Deliver wellness alerts for this line.</p>
      </div>

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
            checked={healthMentionAlerts}
            onCheckedChange={setHealthMentionAlerts}
            disabled={disabled}
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
            checked={moodDropAlerts}
            onCheckedChange={setMoodDropAlerts}
            disabled={disabled}
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
            checked={cognitiveConcernAlerts}
            onCheckedChange={setCognitiveConcernAlerts}
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Delivery method</label>
        <Select
          value={deliveryMethod}
          onValueChange={setDeliveryMethod}
          disabled={disabled}
        >
          <SelectTrigger className="w-full py-2.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DELIVERY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">SMS and push options are coming soon.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          size="small"
          onClick={resetForm}
          disabled={disabled || !hasChanges || isSaving}
        >
          Discard changes
        </Button>
        <Button
          variant="outline"
          size="small"
          onClick={handleSave}
          disabled={disabled || !hasChanges}
          loading={isSaving}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function AlertSettings({ settings, disabled = false }: AlertSettingsProps) {
  const resetHandlers = useRef<Record<string, () => void>>({});
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});

  const registerReset = useCallback((lineId: string, handler: () => void) => {
    resetHandlers.current[lineId] = handler;
  }, []);

  const updateDirty = useCallback((lineId: string, dirty: boolean) => {
    setDirtyMap((prev) => (prev[lineId] === dirty ? prev : { ...prev, [lineId]: dirty }));
  }, []);

  const discardAllChanges = useCallback(() => {
    Object.values(resetHandlers.current).forEach((handler) => handler?.());
  }, []);

  const hasChanges = useMemo(
    () => Object.values(dirtyMap).some(Boolean),
    [dirtyMap]
  );
  const { dialogProps } = useLeavePageGuard({
    isDirty: hasChanges,
    onDiscard: discardAllChanges,
  });

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
              onDirtyChange={(dirty) => updateDirty(entry.line.id, dirty)}
              onRegisterReset={(handler) => registerReset(entry.line.id, handler)}
            />
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </div>
  );
}
