'use client';

import { useState } from 'react';
import { Bell, Brain, Activity } from 'lucide-react';
import { Switch } from '~/core/ui/Switch';
import { Section, SectionHeader, SectionBody } from '~/core/ui/Section';
import { useAutoSave } from '~/core/hooks/use-auto-save';
import { useRouter } from 'next/navigation';
import type { LineRow, NotificationPreferencesRow } from '~/lib/ultaura/types';
import { updateNotificationPreferences } from '~/lib/ultaura/insights';

interface AlertSettingsEntry {
  line: LineRow;
  preferences: NotificationPreferencesRow | null;
}

interface AlertSettingsProps {
  settings: AlertSettingsEntry[];
  deliveryEmail: string;
  disabled?: boolean;
}

function buildDefaults(preferences: NotificationPreferencesRow | null) {
  return {
    health_mention_alerts: preferences?.health_mention_alerts ?? true,
    mood_drop_alerts: preferences?.mood_drop_alerts ?? true,
    cognitive_concern_alerts: preferences?.cognitive_concern_alerts ?? true,
  };
}

type AlertPrefs = {
  health_mention_alerts: boolean;
  mood_drop_alerts: boolean;
  cognitive_concern_alerts: boolean;
};

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
    defaults.health_mention_alerts
  );
  const [moodDropAlerts, setMoodDropAlerts] = useState(defaults.mood_drop_alerts);
  const [cognitiveConcernAlerts, setCognitiveConcernAlerts] = useState(
    defaults.cognitive_concern_alerts
  );

  const alertAutoSave = useAutoSave<AlertPrefs>({
    saveFn: async (value) => {
      try {
        await updateNotificationPreferences(line.account_id, line.id, value);
        return { success: true };
      } catch {
        return { success: false, error: 'Failed to update alert settings' };
      }
    },
    toastSuccess: 'Settings saved',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const triggerSave = (overrides: Partial<AlertPrefs>) => {
    const next = {
      health_mention_alerts: overrides.health_mention_alerts ?? healthMentionAlerts,
      mood_drop_alerts: overrides.mood_drop_alerts ?? moodDropAlerts,
      cognitive_concern_alerts:
        overrides.cognitive_concern_alerts ?? cognitiveConcernAlerts,
    };
    alertAutoSave.triggerSave(next);
  };

  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {line.display_name}
          </div>
        }
        description={`Wellness alert settings for this line.`}
      />
      <SectionBody className="gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Health mention alerts
            </p>
            <p className="text-sm text-muted-foreground">
              Private summary only.
            </p>
          </div>
          <Switch
            checked={healthMentionAlerts}
            onCheckedChange={(checked) => {
              setHealthMentionAlerts(checked);
              triggerSave({ health_mention_alerts: checked });
            }}
            disabled={disabled || alertAutoSave.isSaving}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Mood drop alerts
            </p>
            <p className="text-sm text-muted-foreground">
              Triggered by sudden or sustained drops.
            </p>
          </div>
          <Switch
            checked={moodDropAlerts}
            onCheckedChange={(checked) => {
              setMoodDropAlerts(checked);
              triggerSave({ mood_drop_alerts: checked });
            }}
            disabled={disabled || alertAutoSave.isSaving}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Brain className="h-4 w-4 text-muted-foreground" />
              Cognitive concern alerts
            </p>
            <p className="text-sm text-muted-foreground">
              Notifies after repeated observations.
            </p>
          </div>
          <Switch
            checked={cognitiveConcernAlerts}
            onCheckedChange={(checked) => {
              setCognitiveConcernAlerts(checked);
              triggerSave({ cognitive_concern_alerts: checked });
            }}
            disabled={disabled || alertAutoSave.isSaving}
          />
        </div>

        <p className="text-sm text-muted-foreground pt-2">
          Delivery: Email ({deliveryEmail})
        </p>
      </SectionBody>
    </Section>
  );
}

export function AlertSettings({ settings, deliveryEmail, disabled = false }: AlertSettingsProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Alerts share high-level categories only. Specific details stay private.
      </p>

      {settings.length === 0 ? (
        <Section>
          <SectionBody>
            <p className="text-sm text-muted-foreground">No lines available yet.</p>
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
