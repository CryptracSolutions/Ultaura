'use client';

import { useState } from 'react';
import { Bell, Brain, Activity, Mail, PhoneMissed, User } from 'lucide-react';
import { Switch } from '~/core/ui/Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { Section, SectionHeader, SectionBody } from '~/core/ui/Section';
import { useAutoSave } from '~/core/hooks/use-auto-save';
import { useRouter } from 'next/navigation';
import type { LineRow, NotificationPreferencesRow } from '~/lib/ultaura/types';
import { updateNotificationPreferences } from '~/lib/ultaura/insights';
import { WEEKDAY_OPTIONS, TIME_OPTIONS } from '~/lib/ultaura/constants';

interface AlertSettingsEntry {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
}

interface AlertSettingsProps {
  settings: AlertSettingsEntry[];
  deliveryEmail: string;
  disabled?: boolean;
}

function normalizeTimeValue(raw: string): string {
  if (!raw) return '18:00';
  const parts = raw.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : raw;
}

function buildDefaults(preferences: NotificationPreferencesRow | null) {
  return {
    health_mention_alerts: preferences?.health_mention_alerts ?? true,
    mood_drop_alerts: preferences?.mood_drop_alerts ?? true,
    cognitive_concern_alerts: preferences?.cognitive_concern_alerts ?? true,
    weekly_summary_enabled: preferences?.weekly_summary_enabled ?? true,
    weekly_summary_format: preferences?.weekly_summary_format ?? 'email',
    weekly_summary_day: preferences?.weekly_summary_day ?? 'sunday',
    weekly_summary_time: normalizeTimeValue(
      preferences?.weekly_summary_time ?? '18:00',
    ),
    alert_missed_calls_enabled: preferences?.alert_missed_calls_enabled ?? true,
    alert_missed_calls_threshold:
      preferences?.alert_missed_calls_threshold ?? 3,
  };
}

type AlertPrefs = {
  health_mention_alerts: boolean;
  mood_drop_alerts: boolean;
  cognitive_concern_alerts: boolean;
  weekly_summary_enabled?: boolean;
  weekly_summary_day?: string;
  weekly_summary_time?: string;
  alert_missed_calls_enabled?: boolean;
  alert_missed_calls_threshold?: number;
};

/* ------------------------------------------------------------------ */
/*  Reusable toggle row                                               */
/* ------------------------------------------------------------------ */

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Group heading                                                     */
/* ------------------------------------------------------------------ */

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-line settings section                                         */
/* ------------------------------------------------------------------ */

function AlertSettingsSection({
  line,
  preferences,
  deliveryEmail,
  disabled = false,
}: {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
  deliveryEmail: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const defaults = buildDefaults(preferences);

  const [healthMentionAlerts, setHealthMentionAlerts] = useState(
    defaults.health_mention_alerts,
  );
  const [moodDropAlerts, setMoodDropAlerts] = useState(
    defaults.mood_drop_alerts,
  );
  const [cognitiveConcernAlerts, setCognitiveConcernAlerts] = useState(
    defaults.cognitive_concern_alerts,
  );
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(
    defaults.weekly_summary_enabled,
  );
  const [weeklySummaryDay, setWeeklySummaryDay] = useState(
    defaults.weekly_summary_day,
  );
  const [weeklySummaryTime, setWeeklySummaryTime] = useState(
    defaults.weekly_summary_time,
  );
  const [missedCallsEnabled, setMissedCallsEnabled] = useState(
    defaults.alert_missed_calls_enabled,
  );
  const [missedCallsThreshold, setMissedCallsThreshold] = useState(
    defaults.alert_missed_calls_threshold,
  );

  const alertAutoSave = useAutoSave<AlertPrefs>({
    saveFn: async (value) => {
      try {
        await updateNotificationPreferences(line.account_id, line.id, value);
        return { success: true };
      } catch {
        return { success: false, error: 'Failed to update settings' };
      }
    },
    toastSuccess: 'Settings saved',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const getAllFields = (overrides: Partial<AlertPrefs> = {}): AlertPrefs => ({
    health_mention_alerts:
      overrides.health_mention_alerts ?? healthMentionAlerts,
    mood_drop_alerts: overrides.mood_drop_alerts ?? moodDropAlerts,
    cognitive_concern_alerts:
      overrides.cognitive_concern_alerts ?? cognitiveConcernAlerts,
    weekly_summary_enabled:
      overrides.weekly_summary_enabled ?? weeklySummaryEnabled,
    weekly_summary_day: overrides.weekly_summary_day ?? weeklySummaryDay,
    weekly_summary_time: overrides.weekly_summary_time ?? weeklySummaryTime,
    alert_missed_calls_enabled:
      overrides.alert_missed_calls_enabled ?? missedCallsEnabled,
    alert_missed_calls_threshold:
      overrides.alert_missed_calls_threshold ?? missedCallsThreshold,
  });

  const triggerSave = (overrides: Partial<AlertPrefs>) => {
    alertAutoSave.triggerSave(getAllFields(overrides));
  };

  const isSaving = alertAutoSave.isSaving;

  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {line.display_name}
          </div>
        }
        description="Manage alerts, weekly summaries, and missed call notifications."
      />
      <SectionBody className="gap-0">
        {/* ── Wellness Alerts ── */}
        <div className="space-y-5 pb-6">
          <GroupHeading>Wellness Alerts</GroupHeading>

          <ToggleRow
            icon={Bell}
            label="Health mentions"
            description="Alert when health concerns are mentioned during calls."
            checked={healthMentionAlerts}
            onCheckedChange={(checked) => {
              setHealthMentionAlerts(checked);
              triggerSave({ health_mention_alerts: checked });
            }}
            disabled={disabled || isSaving}
          />

          <ToggleRow
            icon={Activity}
            label="Mood drops"
            description="Triggered by sudden or sustained mood drops."
            checked={moodDropAlerts}
            onCheckedChange={(checked) => {
              setMoodDropAlerts(checked);
              triggerSave({ mood_drop_alerts: checked });
            }}
            disabled={disabled || isSaving}
          />

          <ToggleRow
            icon={Brain}
            label="Cognitive concerns"
            description="Notifies after repeated observations over multiple calls."
            checked={cognitiveConcernAlerts}
            onCheckedChange={(checked) => {
              setCognitiveConcernAlerts(checked);
              triggerSave({ cognitive_concern_alerts: checked });
            }}
            disabled={disabled || isSaving}
          />
        </div>

        <hr className="border-border" />

        {/* ── Weekly Summary ── */}
        <div className="space-y-5 py-6">
          <GroupHeading>Weekly Summary</GroupHeading>

          <ToggleRow
            icon={Mail}
            label="Weekly email recap"
            description="A weekly recap of call activity, mood, and wellbeing notes."
            checked={weeklySummaryEnabled}
            onCheckedChange={(checked) => {
              setWeeklySummaryEnabled(checked);
              triggerSave({ weekly_summary_enabled: checked });
            }}
            disabled={disabled}
          />

          {weeklySummaryEnabled && (
            <div className="pl-[26px] grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Day
                </label>
                <Select
                  value={weeklySummaryDay}
                  onValueChange={(value) => {
                    setWeeklySummaryDay(value);
                    triggerSave({ weekly_summary_day: value });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Time
                </label>
                <Select
                  value={weeklySummaryTime}
                  onValueChange={(value) => {
                    setWeeklySummaryTime(value);
                    triggerSave({ weekly_summary_time: value });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <hr className="border-border" />

        {/* ── Missed Call Alerts ── */}
        <div className="space-y-5 pt-6">
          <GroupHeading>Missed Call Alerts</GroupHeading>

          <ToggleRow
            icon={PhoneMissed}
            label="Alert on missed calls"
            description="Get notified when consecutive scheduled calls go unanswered."
            checked={missedCallsEnabled}
            onCheckedChange={(checked) => {
              setMissedCallsEnabled(checked);
              triggerSave({ alert_missed_calls_enabled: checked });
            }}
            disabled={disabled}
          />

          {missedCallsEnabled && (
            <div className="pl-[26px]">
              <label className="text-xs text-muted-foreground block mb-1">
                Alert after
              </label>
              <Select
                value={String(missedCallsThreshold)}
                onValueChange={(value) => {
                  const num = Number(value);
                  setMissedCallsThreshold(num);
                  triggerSave({ alert_missed_calls_threshold: num });
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-full sm:w-1/2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5].map((threshold) => (
                    <SelectItem key={threshold} value={String(threshold)}>
                      {threshold} calls
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </SectionBody>
    </Section>
  );
}

export function AlertSettings({
  settings,
  deliveryEmail,
  disabled = false,
}: AlertSettingsProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Alerts share high-level categories only. Specific details stay private.
      </p>

      {settings.length === 0 ? (
        <Section>
          <SectionBody>
            <p className="text-sm text-muted-foreground">
              No lines available yet.
            </p>
          </SectionBody>
        </Section>
      ) : (
        settings.map((entry) => (
          <AlertSettingsSection
            key={entry.line.id}
            line={entry.line}
            preferences={entry.preferences}
            deliveryEmail={deliveryEmail}
            disabled={disabled}
          />
        ))
      )}
    </div>
  );
}
