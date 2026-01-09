'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Settings, Globe, Clock, Bell, Voicemail, Sparkles, Mail, AlertTriangle } from 'lucide-react';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Switch } from '~/core/ui/Switch';
import type { LineRow, VoicemailBehavior, InsightPrivacyRow, NotificationPreferencesRow } from '~/lib/ultaura/types';
import { updateLine } from '~/lib/ultaura/lines';
import { INSIGHTS, US_TIMEZONES, TIME_OPTIONS, WEEKDAY_OPTIONS } from '~/lib/ultaura/constants';
import { setPauseMode, updateInsightPrivacy, updateNotificationPreferences } from '~/lib/ultaura/insights';

interface SettingsClientProps {
  line: LineRow;
  insightPrivacy: InsightPrivacyRow | null;
  notificationPreferences: NotificationPreferencesRow | null;
  disabled?: boolean;
}

export function SettingsClient({
  line,
  insightPrivacy,
  notificationPreferences,
  disabled = false,
}: SettingsClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [timezone, setTimezone] = useState(line.timezone);
  const [quietHoursStart, setQuietHoursStart] = useState(line.quiet_hours_start);
  const [quietHoursEnd, setQuietHoursEnd] = useState(line.quiet_hours_end);
  const [allowVoiceReminderControl, setAllowVoiceReminderControl] = useState(
    line.allow_voice_reminder_control ?? true
  );
  const [voicemailBehavior, setVoicemailBehavior] = useState<VoicemailBehavior>(
    (line.voicemail_behavior || 'brief') as VoicemailBehavior
  );

  const privacyDefaults = {
    insights_enabled: insightPrivacy?.insights_enabled ?? true,
    private_topic_codes: insightPrivacy?.private_topic_codes ?? [],
    is_paused: insightPrivacy?.is_paused ?? false,
    paused_reason: insightPrivacy?.paused_reason ?? '',
  };

  const normalizeTimeValue = (value: string) =>
    value.length > 5 ? value.slice(0, 5) : value;

  const notificationDefaults = {
    weekly_summary_enabled: notificationPreferences?.weekly_summary_enabled ?? true,
    weekly_summary_format: notificationPreferences?.weekly_summary_format ?? 'email',
    weekly_summary_day: notificationPreferences?.weekly_summary_day ?? 'sunday',
    weekly_summary_time: normalizeTimeValue(
      notificationPreferences?.weekly_summary_time ?? '18:00'
    ),
    alert_missed_calls_enabled: notificationPreferences?.alert_missed_calls_enabled ?? true,
    alert_missed_calls_threshold: notificationPreferences?.alert_missed_calls_threshold ?? 3,
  };

  const [insightsEnabled, setInsightsEnabled] = useState(privacyDefaults.insights_enabled);
  const [privateTopicCodes, setPrivateTopicCodes] = useState<string[]>(
    privacyDefaults.private_topic_codes ?? []
  );
  const [isPaused, setIsPaused] = useState(privacyDefaults.is_paused);
  const [pausedReason, setPausedReason] = useState(privacyDefaults.paused_reason || '');

  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(
    notificationDefaults.weekly_summary_enabled
  );
  const [weeklySummaryDay, setWeeklySummaryDay] = useState(
    notificationDefaults.weekly_summary_day
  );
  const [weeklySummaryTime, setWeeklySummaryTime] = useState(
    notificationDefaults.weekly_summary_time
  );
  const [missedCallsEnabled, setMissedCallsEnabled] = useState(
    notificationDefaults.alert_missed_calls_enabled
  );
  const [missedCallsThreshold, setMissedCallsThreshold] = useState(
    notificationDefaults.alert_missed_calls_threshold
  );

  const weeklySummaryFormat = notificationDefaults.weekly_summary_format;
  const weeklySummaryDeliveryLabel =
    weeklySummaryFormat === 'email' ? 'Email' : 'Email (SMS coming soon)';

  const togglePrivateTopic = (code: string) => {
    setPrivateTopicCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((item) => item !== code);
      }
      return [...prev, code];
    });
  };

  const handlePauseToggle = (checked: boolean) => {
    setIsPaused(checked);
    if (!checked) {
      setPausedReason('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      if (hasLineChanges) {
        const result = await updateLine(line.id, {
          timezone,
          quietHoursStart,
          quietHoursEnd,
          allowVoiceReminderControl,
          voicemailBehavior,
        });

        if (!result.success) {
          setError(result.error.message || 'Failed to update line settings');
          return;
        }
      }

      if (hasInsightPrivacyChanges) {
        await updateInsightPrivacy(line.id, {
          insights_enabled: insightsEnabled,
          private_topic_codes: privateTopicCodes,
        });
      }

      if (hasPauseChanges) {
        await setPauseMode(line.id, isPaused, pausedReason);
      }

      if (hasNotificationChanges) {
        await updateNotificationPreferences(line.account_id, line.id, {
          weekly_summary_enabled: weeklySummaryEnabled,
          weekly_summary_day: weeklySummaryDay,
          weekly_summary_time: weeklySummaryTime,
          alert_missed_calls_enabled: missedCallsEnabled,
          alert_missed_calls_threshold: missedCallsThreshold,
        });
      }

      toast.success('Settings saved');
      router.push(`/dashboard/lines/${line.short_id}`);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeCodes = (codes: string[]) => [...codes].sort().join('|');

  const hasLineChanges =
    timezone !== line.timezone ||
    quietHoursStart !== line.quiet_hours_start ||
    quietHoursEnd !== line.quiet_hours_end ||
    allowVoiceReminderControl !== (line.allow_voice_reminder_control ?? true) ||
    voicemailBehavior !== (line.voicemail_behavior || 'brief');

  const hasInsightPrivacyChanges =
    insightsEnabled !== privacyDefaults.insights_enabled ||
    normalizeCodes(privateTopicCodes) !== normalizeCodes(privacyDefaults.private_topic_codes || []);

  const hasPauseChanges =
    isPaused !== privacyDefaults.is_paused ||
    (isPaused && pausedReason.trim() !== (privacyDefaults.paused_reason || '').trim());

  const hasNotificationChanges =
    weeklySummaryEnabled !== notificationDefaults.weekly_summary_enabled ||
    weeklySummaryDay !== notificationDefaults.weekly_summary_day ||
    weeklySummaryTime !== notificationDefaults.weekly_summary_time ||
    missedCallsEnabled !== notificationDefaults.alert_missed_calls_enabled ||
    missedCallsThreshold !== notificationDefaults.alert_missed_calls_threshold;

  const hasChanges =
    hasLineChanges ||
    hasInsightPrivacyChanges ||
    hasPauseChanges ||
    hasNotificationChanges;

  return (
    <div className="w-full p-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/lines/${line.short_id}`}
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
              When I don&apos;t answer a call:
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
                  <p className="text-sm font-medium text-foreground">Don&apos;t leave a message</p>
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

          {/* Insights & Privacy */}
          <div className="pt-6 border-t border-border space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                Insights & Privacy
              </div>
              <p className="text-sm text-muted-foreground">
                Control how insights are generated and which topics stay private.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground">
                  Enable call insights
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Summaries include mood, topics, and wellbeing notes. No transcripts are stored.
                </p>
              </div>
              <Switch
                checked={insightsEnabled}
                onCheckedChange={setInsightsEnabled}
                disabled={disabled}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Private topics</label>
              <p className="text-sm text-muted-foreground mt-1">
                Mark topics to hide from the insights dashboard and weekly summaries.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INSIGHTS.TOPIC_CODES.map((code) => {
                  const isPrivate = privateTopicCodes.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => togglePrivateTopic(code)}
                      disabled={disabled}
                      className={[
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        isPrivate
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-border bg-background text-foreground hover:bg-muted',
                        disabled ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {INSIGHTS.TOPIC_LABELS[code]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">
                    Pause insights and alerts
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use this when someone is away or prefers a break. Weekly summaries still send.
                  </p>
                </div>
                <Switch
                  checked={isPaused}
                  onCheckedChange={handlePauseToggle}
                  disabled={disabled}
                />
              </div>
              {isPaused && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Pause reason (optional)
                  </label>
                  <input
                    type="text"
                    value={pausedReason}
                    onChange={(e) => setPausedReason(e.target.value)}
                    placeholder="e.g., Traveling this week"
                    disabled={disabled}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Weekly Summary */}
          <div className="pt-6 border-t border-border space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Weekly Summary
              </div>
              <p className="text-sm text-muted-foreground">
                Receive a weekly email recap of calls, mood, and wellbeing notes.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground">
                  Send weekly summary emails
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Delivered to the billing email on your account.
                </p>
              </div>
              <Switch
                checked={weeklySummaryEnabled}
                onCheckedChange={setWeeklySummaryEnabled}
                disabled={disabled}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Day</label>
                <Select
                  value={weeklySummaryDay}
                  onValueChange={setWeeklySummaryDay}
                  disabled={disabled || !weeklySummaryEnabled}
                >
                  <SelectTrigger className="w-full py-3">
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
                <label className="text-xs text-muted-foreground block mb-1">Time</label>
                <Select
                  value={weeklySummaryTime}
                  onValueChange={setWeeklySummaryTime}
                  disabled={disabled || !weeklySummaryEnabled}
                >
                  <SelectTrigger className="w-full py-3">
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

            <p className="text-xs text-muted-foreground">
              Delivery: {weeklySummaryDeliveryLabel}.
            </p>

            <div className="pt-4 border-t border-border/60 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                    Missed call alerts
                  </label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send an email when consecutive scheduled calls are missed.
                  </p>
                </div>
                <Switch
                  checked={missedCallsEnabled}
                  onCheckedChange={setMissedCallsEnabled}
                  disabled={disabled}
                />
              </div>
              <div className="max-w-xs">
                <label className="text-xs text-muted-foreground block mb-1">Alert after</label>
                <Select
                  value={String(missedCallsThreshold)}
                  onValueChange={(value) => setMissedCallsThreshold(Number(value))}
                  disabled={disabled || !missedCallsEnabled}
                >
                  <SelectTrigger className="w-full py-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5].map((threshold) => (
                      <SelectItem key={threshold} value={String(threshold)}>
                        {threshold} missed calls
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3 pt-2">
          <Link
            href={`/dashboard/lines/${line.short_id}`}
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
