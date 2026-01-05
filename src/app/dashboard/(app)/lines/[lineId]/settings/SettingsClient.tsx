'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Settings, Globe, Clock, MessageSquare, Bell, Voicemail } from 'lucide-react';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Switch } from '~/core/ui/Switch';
import type { LineRow, VoicemailBehavior } from '~/lib/ultaura/types';
import { updateLine } from '~/lib/ultaura/actions';
import {
  US_TIMEZONES,
  LANGUAGE_LABELS,
  SPANISH_FORMALITY_LABELS,
  TIME_OPTIONS,
  getShortLineId,
} from '~/lib/ultaura';

interface SettingsClientProps {
  line: LineRow;
  disabled?: boolean;
}

export function SettingsClient({ line, disabled = false }: SettingsClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [timezone, setTimezone] = useState(line.timezone);
  const [language, setLanguage] = useState(line.preferred_language);
  const [spanishFormality, setSpanishFormality] = useState(line.spanish_formality);
  const [quietHoursStart, setQuietHoursStart] = useState(line.quiet_hours_start);
  const [quietHoursEnd, setQuietHoursEnd] = useState(line.quiet_hours_end);
  const [allowVoiceReminderControl, setAllowVoiceReminderControl] = useState(
    line.allow_voice_reminder_control ?? true
  );
  const [voicemailBehavior, setVoicemailBehavior] = useState<VoicemailBehavior>(
    line.voicemail_behavior || 'brief'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await updateLine(line.id, {
        timezone,
        preferredLanguage: language,
        spanishFormality,
        quietHoursStart,
        quietHoursEnd,
        allowVoiceReminderControl,
        voicemailBehavior,
      });

      if (result.success) {
        toast.success('Settings saved');
        router.push(`/dashboard/lines/${getShortLineId(line.id)}`);
        router.refresh();
      } else {
        setError(result.error || 'Failed to update settings');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges =
    timezone !== line.timezone ||
    language !== line.preferred_language ||
    spanishFormality !== line.spanish_formality ||
    quietHoursStart !== line.quiet_hours_start ||
    quietHoursEnd !== line.quiet_hours_end ||
    allowVoiceReminderControl !== (line.allow_voice_reminder_control ?? true) ||
    voicemailBehavior !== (line.voicemail_behavior || 'brief');

  return (
    <div className="w-full p-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/lines/${getShortLineId(line.id)}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {line.display_name}
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Line Settings</h1>
            <p className="text-muted-foreground">Configure settings for {line.display_name}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          {/* Timezone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full py-3" disabled={disabled}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              All call times and quiet hours are based on this timezone.
            </p>
          </div>

          {/* Language */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Preferred Language
            </label>
            <Select value={language} onValueChange={(val) => setLanguage(val as 'auto' | 'en' | 'es')}>
              <SelectTrigger className="w-full py-3" disabled={disabled}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spanish Formality (only show if Spanish selected) */}
          {language === 'es' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Spanish Formality
              </label>
              <div className="flex gap-3">
                {Object.entries(SPANISH_FORMALITY_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpanishFormality(value as 'usted' | 'tu')}
                    disabled={disabled}
                    className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                      spanishFormality === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-foreground hover:border-primary/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Choose how Ultaura addresses your loved one in Spanish.
              </p>
            </div>
          )}

          {/* Quiet Hours */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Quiet Hours
            </label>
            <p className="text-sm text-muted-foreground mb-3">
              Ultaura will not make calls during these hours.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start</label>
                <Select value={quietHoursStart} onValueChange={setQuietHoursStart}>
                  <SelectTrigger className="w-full py-3" disabled={disabled}>
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
              <div>
                <label className="text-xs text-muted-foreground block mb-1">End</label>
                <Select value={quietHoursEnd} onValueChange={setQuietHoursEnd}>
                  <SelectTrigger className="w-full py-3" disabled={disabled}>
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
          </div>

          {/* Voicemail Settings */}
          <div className="pt-6 border-t border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Voicemail className="w-4 h-4 text-muted-foreground" />
              Voicemail Settings
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              When I don't answer a call:
            </p>
            <RadioGroup
              value={voicemailBehavior}
              onValueChange={(value) => setVoicemailBehavior(value as VoicemailBehavior)}
              className="gap-3"
              disabled={disabled}
            >
              <RadioGroupItemLabel>
                <RadioGroupItem value="none" />
                <div>
                  <p className="text-sm font-medium text-foreground">Don't leave a message</p>
                  <p className="text-xs text-muted-foreground">Hang up quietly</p>
                </div>
              </RadioGroupItemLabel>
              <RadioGroupItemLabel>
                <RadioGroupItem value="brief" />
                <div>
                  <p className="text-sm font-medium text-foreground">Leave a brief message</p>
                  <p className="text-xs text-muted-foreground">Leave a short message</p>
                </div>
              </RadioGroupItemLabel>
              <RadioGroupItemLabel>
                <RadioGroupItem value="detailed" />
                <div>
                  <p className="text-sm font-medium text-foreground">Leave a detailed message</p>
                  <p className="text-xs text-muted-foreground">Include why I was calling</p>
                </div>
              </RadioGroupItemLabel>
            </RadioGroup>
          </div>

          {/* Voice Reminder Control */}
          <div className="pt-6 border-t border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  Voice Reminder Control
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  When enabled, {line.display_name} can create, edit, pause, and cancel
                  reminders during phone calls. Disable this to restrict reminder
                  management to the dashboard only.
                </p>
              </div>
              <Switch
                checked={allowVoiceReminderControl}
                onCheckedChange={setAllowVoiceReminderControl}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3 pt-2">
          <Link
            href={`/dashboard/lines/${getShortLineId(line.id)}`}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={disabled || isLoading || !hasChanges}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
