'use client';

import { Mic, ShieldCheck, Sparkles } from 'lucide-react';

import { Switch } from '~/core/ui/Switch';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';

export interface PrivacyControlsSectionProps {
  recordingEnabled: boolean;
  aiSummarizationEnabled: boolean;
  isSaving: boolean;
  isPrivacySettingsUnavailable: boolean;
  onRecordingToggle: (enabled: boolean) => void;
  onSummarizationToggle: (enabled: boolean) => void;
}

export function PrivacyControlsSection({
  recordingEnabled,
  aiSummarizationEnabled,
  isSaving,
  isPrivacySettingsUnavailable,
  onRecordingToggle,
  onSummarizationToggle,
}: PrivacyControlsSectionProps) {
  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Privacy controls
          </div>
        }
        description="These are account-level permissions. Seniors still give voice consent during calls."
      />
      <SectionBody className="gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mic className="h-4 w-4 text-muted-foreground" />
              Call recording
            </p>
            <p className="text-sm text-muted-foreground">
              Allows recording when a senior grants consent on their call.
              Disclosure is always announced at call start.
            </p>
          </div>
          <Switch
            aria-label="Call recording permission"
            checked={recordingEnabled}
            onCheckedChange={onRecordingToggle}
            disabled={isSaving || isPrivacySettingsUnavailable}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              AI memory & personalization
            </p>
            <p className="text-sm text-muted-foreground">
              Controls memory storage and post-call summaries for lines that
              grant memory consent. This can stay on even if call recording is
              off. Turning this back on may re-ask memory consent for lines that
              previously declined.
            </p>
          </div>
          <Switch
            aria-label="AI memory and personalization"
            checked={aiSummarizationEnabled}
            onCheckedChange={onSummarizationToggle}
            disabled={isSaving || isPrivacySettingsUnavailable}
          />
        </div>
      </SectionBody>
    </Section>
  );
}
