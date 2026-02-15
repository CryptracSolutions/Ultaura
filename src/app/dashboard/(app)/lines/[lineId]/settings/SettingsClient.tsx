'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Globe,
  Languages,
  Clock,
  Bell,
  Voicemail,
  Sparkles,
  Mail,
  AlertTriangle,
  Ear,
  PhoneIncoming,
  Palmtree,
  Mic,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import classNames from 'clsx';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Switch } from '~/core/ui/Switch';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/core/ui/Accordion';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';
import { useTranslation } from 'react-i18next';
import { useAutoSave } from '~/core/hooks/use-auto-save';
import type {
  LineRow,
  VoicemailBehavior,
  InsightPrivacySettings,
  NotificationPreferencesRow,
  AccessibilitySettingsRow,
  LineVoiceConsent,
} from '~/lib/ultaura/types';
import { updateLine } from '~/lib/ultaura/lines';
import { LANGUAGE_OPTIONS, US_TIMEZONES, TIME_OPTIONS, WEEKDAY_OPTIONS } from '~/lib/ultaura/constants';
import { setPauseMode, updateInsightPrivacy, updateNotificationPreferences } from '~/lib/ultaura/insights';
import { requestInsightsRePrompt } from '~/lib/ultaura/privacy';
import { updateAccessibilitySettings } from '~/lib/ultaura/accessibility';
import { parseVacationRanges } from '~/lib/ultaura/vacation-utils';
import { VacationSettings } from './VacationSettings';
import { getLanguageDisplayName } from '~/lib/ultaura/language';
import { DEFAULT_GROK_VOICE, type GrokVoice, isGrokVoice } from '~/lib/ultaura/voices';
import { VoiceSelector } from './components/VoiceSelector';
import TextField from '~/core/ui/TextField';

interface SettingsClientProps {
  line: LineRow;
  insightPrivacy: InsightPrivacySettings | null;
  notificationPreferences: NotificationPreferencesRow | null;
  accessibilitySettings: AccessibilitySettingsRow | null;
  voiceConsent: LineVoiceConsent | null;
  userType: 'self' | 'family_managed';
  disabled?: boolean;
}

type LineSettingsSectionValue =
  | 'language'
  | 'voice-preference'
  | 'timezone'
  | 'quiet-hours'
  | 'voicemail'
  | 'inbound'
  | 'voice-controls'
  | 'vacation'
  | 'insights-privacy'
  | 'weekly-summary'
  | 'missed-calls'
  | 'accessibility';

type LineSettingsTabValue = 'settings' | 'call-controls';

type LineSettingsSectionConfig = {
  value: LineSettingsSectionValue;
  label: string;
  icon: LucideIcon;
};

const buildLineSettingsSections = (
  voiceLabel: string
): Record<
  LineSettingsTabValue,
  { groups: Array<{ label: string; sections: LineSettingsSectionConfig[] }> }
> => ({
  settings: {
    groups: [
      {
        label: 'Time & Location',
        sections: [{ value: 'timezone', label: 'Timezone', icon: Globe }],
      },
      {
        label: 'Language',
        sections: [{ value: 'language', label: 'Language', icon: Languages }],
      },
      {
        label: 'Insights & Alerts',
        sections: [
          { value: 'insights-privacy', label: 'Insights & Privacy', icon: Sparkles },
          { value: 'weekly-summary', label: 'Weekly Summary', icon: Mail },
          { value: 'missed-calls', label: 'Missed Call Alerts', icon: AlertTriangle },
        ],
      },
      {
        label: 'Accessibility',
        sections: [{ value: 'accessibility', label: 'Accessibility', icon: Ear }],
      },
    ],
  },
  'call-controls': {
    groups: [
      {
        label: 'Voice & Language',
        sections: [
          { value: 'voice-preference', label: voiceLabel, icon: Mic },
          { value: 'voice-controls', label: 'Voice Controls', icon: Bell },
        ],
      },
      {
        label: 'Call Behavior',
        sections: [
          { value: 'voicemail', label: 'Voicemail', icon: Voicemail },
          { value: 'inbound', label: 'Inbound Calls', icon: PhoneIncoming },
        ],
      },
      {
        label: 'Availability',
        sections: [
          { value: 'quiet-hours', label: 'Quiet Hours', icon: Clock },
          { value: 'vacation', label: 'Vacation', icon: Palmtree },
        ],
      },
    ],
  },
});

function buildSettingsUrl(
  lineShortId: string,
  tab: LineSettingsTabValue,
  section?: LineSettingsSectionValue
) {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (section) {
    params.set('section', section);
  }
  return `/dashboard/lines/${lineShortId}/settings?${params.toString()}`;
}


export function SettingsClient({
  line,
  insightPrivacy,
  notificationPreferences,
  accessibilitySettings,
  voiceConsent,
  userType,
  disabled = false,
}: SettingsClientProps) {
  const { t } = useTranslation('voices');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const normalizeTimeValue = (value: string) =>
    value.length > 5 ? value.slice(0, 5) : value;
  const normalizeLanguageValue = (value: string | null | undefined) => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'auto' || normalized === 'auto-detect' || normalized === 'auto_detect') {
      return null;
    }
    const normalizedHyphen = normalized.replace('_', '-');
    return normalizedHyphen.includes('-')
      ? normalizedHyphen.split('-')[0]
      : normalizedHyphen;
  };

  // Form state
  const canonicalLinePreferredLanguage = normalizeLanguageValue(
    line.preferred_language_iso ?? line.preferred_language_bcp47 ?? null
  );
  const [timezone, setTimezone] = useState(line.timezone);
  const [quietHoursStart, setQuietHoursStart] = useState(
    normalizeTimeValue(line.quiet_hours_start)
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    normalizeTimeValue(line.quiet_hours_end)
  );
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(
    canonicalLinePreferredLanguage
  );
  const [allowVoiceReminderControl, setAllowVoiceReminderControl] = useState(
    line.allow_voice_reminder_control ?? true
  );
  const [allowVoiceScheduleControl, setAllowVoiceScheduleControl] = useState(
    line.allow_voice_schedule_control ?? true
  );
  const [inboundAllowed, setInboundAllowed] = useState(line.inbound_allowed ?? true);
  const [voicemailBehavior, setVoicemailBehavior] = useState<VoicemailBehavior>(
    (line.voicemail_behavior || 'brief') as VoicemailBehavior
  );
  const initialVoice = isGrokVoice(line.preferred_grok_voice)
    ? line.preferred_grok_voice
    : DEFAULT_GROK_VOICE;
  const [selectedVoice, setSelectedVoice] = useState<GrokVoice>(initialVoice);
  const vacationRanges = useMemo(
    () => parseVacationRanges(line.vacation_ranges),
    [line.vacation_ranges]
  );
  const effectiveTimezone = timezone || line.timezone || '';
  const timezoneOptions = useMemo(() => {
    if (!line.timezone || US_TIMEZONES.some((tz) => tz.value === line.timezone)) {
      return US_TIMEZONES;
    }

    return [{ value: line.timezone, label: line.timezone }, ...US_TIMEZONES];
  }, [line.timezone]);
  useEffect(() => {
    if (!timezone && line.timezone) {
      setTimezone(line.timezone);
    }
  }, [line.timezone, timezone]);

  const accessibilityDefaults = {
    hearing_mode: accessibilitySettings?.hearing_mode ?? 'normal',
    speech_rate: accessibilitySettings?.speech_rate ?? 1.0,
    cognitive_mode: accessibilitySettings?.cognitive_mode ?? 'normal',
    context_window_calls: accessibilitySettings?.context_window_calls ?? 10,
  };

  const privacyDefaults = {
    insights_enabled: insightPrivacy?.insights_enabled ?? true,
    is_paused: insightPrivacy?.is_paused ?? false,
  };

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
  const [isPaused, setIsPaused] = useState(privacyDefaults.is_paused);

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

  const [hearingMode, setHearingMode] = useState(accessibilityDefaults.hearing_mode);
  const [speechRate, setSpeechRate] = useState(accessibilityDefaults.speech_rate);
  const [cognitiveMode, setCognitiveMode] = useState(accessibilityDefaults.cognitive_mode);
  const [contextWindowCalls, setContextWindowCalls] = useState(
    accessibilityDefaults.context_window_calls
  );

  const weeklySummaryFormat = notificationDefaults.weekly_summary_format;
  const weeklySummaryDeliveryLabel =
    weeklySummaryFormat === 'email' ? 'Email' : 'Email (SMS coming soon)';

  const [isRequestingInsightsChange, setIsRequestingInsightsChange] = useState(false);
  const [insightsRepromptRequested, setInsightsRepromptRequested] = useState(
    Boolean(voiceConsent?.insightsRepromptRequestedAt)
  );

  const handleRequestInsightsRePrompt = async () => {
    if (disabled || isRequestingInsightsChange || insightsRepromptRequested) {
      return;
    }

    setIsRequestingInsightsChange(true);
    const result = await requestInsightsRePrompt(line.id);

    if (!result.success) {
      toast.error(result.error || 'Failed to request insights change');
      setIsRequestingInsightsChange(false);
      return;
    }

    toast.success('Request sent. We will check in on the next call.');
    setInsightsRepromptRequested(true);
    setIsRequestingInsightsChange(false);
  };

  // --- Auto-save hooks ---

  const lineAutoSave = useAutoSave<{
    timezone: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    language: string | null;
    voiceReminderControl: boolean;
    voiceScheduleControl: boolean;
    inboundAllowed: boolean;
    voicemailBehavior: VoicemailBehavior;
  }>({
    saveFn: async (value) => {
      const result = await updateLine(line.id, {
        timezone: value.timezone,
        quietHoursStart: normalizeTimeValue(value.quietHoursStart),
        quietHoursEnd: normalizeTimeValue(value.quietHoursEnd),
        allowVoiceReminderControl: value.voiceReminderControl,
        allowVoiceScheduleControl: value.voiceScheduleControl,
        inboundAllowed: value.inboundAllowed,
        voicemailBehavior: value.voicemailBehavior,
        preferredLanguageIso: normalizeLanguageValue(value.language),
      });
      if (result.success) return { success: true };
      return { success: false, error: result.error.message || 'Failed to save' };
    },
    toastSuccess: 'Settings saved',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const voiceAutoSave = useAutoSave<GrokVoice>({
    saveFn: async (value) => {
      const result = await updateLine(line.id, { preferredGrokVoice: value });
      if (result.success) return { success: true };
      return { success: false, error: result.error.message || 'Failed to save' };
    },
    toastSuccess: 'Voice updated',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const insightAutoSave = useAutoSave<boolean>({
    saveFn: async (value) => {
      try {
        await updateInsightPrivacy(line.id, { insights_enabled: value });
        return { success: true };
      } catch {
        return { success: false, error: 'Failed to update insights' };
      }
    },
    toastSuccess: 'Insights updated',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const pauseAutoSave = useAutoSave<{ isPaused: boolean }>({
    saveFn: async (value) => {
      try {
        await setPauseMode(line.id, value.isPaused);
        return { success: true };
      } catch {
        return { success: false, error: 'Failed to update pause mode' };
      }
    },
    toastSuccess: 'Pause updated',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const notifAutoSave = useAutoSave<{
    weeklySummaryEnabled: boolean;
    weeklySummaryDay: string;
    weeklySummaryTime: string;
    missedCallsEnabled: boolean;
    missedCallsThreshold: number;
  }>({
    saveFn: async (value) => {
      try {
        await updateNotificationPreferences(line.account_id, line.id, {
          weekly_summary_enabled: value.weeklySummaryEnabled,
          weekly_summary_day: value.weeklySummaryDay,
          weekly_summary_time: value.weeklySummaryTime,
          alert_missed_calls_enabled: value.missedCallsEnabled,
          alert_missed_calls_threshold: value.missedCallsThreshold,
        });
        return { success: true };
      } catch {
        return { success: false, error: 'Failed to update notifications' };
      }
    },
    toastSuccess: 'Notifications updated',
    onSuccess: () => router.refresh(),
    disabled,
  });

  const a11yAutoSave = useAutoSave<{
    hearingMode: string;
    speechRate: number;
    cognitiveMode: string;
    contextWindowCalls: number;
  }>({
    saveFn: async (value) => {
      const result = await updateAccessibilitySettings(line.id, {
        hearingMode: value.hearingMode,
        speechRate: value.speechRate,
        cognitiveMode: value.cognitiveMode,
        contextWindowCalls: value.contextWindowCalls,
      });
      if (result.success) return { success: true };
      return { success: false, error: result.error.message || 'Failed to save' };
    },
    toastSuccess: 'Accessibility updated',
    onSuccess: () => router.refresh(),
    disabled,
  });

  // Best-effort flush on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      lineAutoSave.flush();
      voiceAutoSave.flush();
      insightAutoSave.flush();
      pauseAutoSave.flush();
      notifAutoSave.flush();
      a11yAutoSave.flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Helper to build current line fields for triggerSave ---
  const getLineFields = (overrides: Partial<{
    timezone: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    language: string | null;
    voiceReminderControl: boolean;
    voiceScheduleControl: boolean;
    inboundAllowed: boolean;
    voicemailBehavior: VoicemailBehavior;
  }> = {}) => ({
    timezone: overrides.timezone ?? effectiveTimezone,
    quietHoursStart: overrides.quietHoursStart ?? quietHoursStart,
    quietHoursEnd: overrides.quietHoursEnd ?? quietHoursEnd,
    language: overrides.language !== undefined ? overrides.language : preferredLanguage,
    voiceReminderControl: overrides.voiceReminderControl ?? allowVoiceReminderControl,
    voiceScheduleControl: overrides.voiceScheduleControl ?? allowVoiceScheduleControl,
    inboundAllowed: overrides.inboundAllowed ?? inboundAllowed,
    voicemailBehavior: overrides.voicemailBehavior ?? voicemailBehavior,
  });

  const getNotifFields = (overrides: Partial<{
    weeklySummaryEnabled: boolean;
    weeklySummaryDay: string;
    weeklySummaryTime: string;
    missedCallsEnabled: boolean;
    missedCallsThreshold: number;
  }> = {}) => ({
    weeklySummaryEnabled: overrides.weeklySummaryEnabled ?? weeklySummaryEnabled,
    weeklySummaryDay: overrides.weeklySummaryDay ?? weeklySummaryDay,
    weeklySummaryTime: overrides.weeklySummaryTime ?? weeklySummaryTime,
    missedCallsEnabled: overrides.missedCallsEnabled ?? missedCallsEnabled,
    missedCallsThreshold: overrides.missedCallsThreshold ?? missedCallsThreshold,
  });

  const getA11yFields = (overrides: Partial<{
    hearingMode: string;
    speechRate: number;
    cognitiveMode: string;
    contextWindowCalls: number;
  }> = {}) => ({
    hearingMode: overrides.hearingMode ?? hearingMode,
    speechRate: overrides.speechRate ?? speechRate,
    cognitiveMode: overrides.cognitiveMode ?? cognitiveMode,
    contextWindowCalls: overrides.contextWindowCalls ?? contextWindowCalls,
  });

  const tabParam = searchParams.get('tab') as LineSettingsTabValue | null;
  const activeTab = tabParam ?? 'settings';
  const lineSettingsSections = useMemo(
    () => buildLineSettingsSections(t('ui.voicePreference.sectionLabel')),
    [t]
  );
  const groupsForTab = lineSettingsSections[activeTab].groups;
  const sectionsForTab = useMemo(
    () => groupsForTab.flatMap((group) => group.sections),
    [groupsForTab]
  );
  const sectionParam = searchParams.get('section') as LineSettingsSectionValue | null;
  const activeSection =
    sectionsForTab.find((section) => section.value === sectionParam) ??
    sectionsForTab[0];
  const currentHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const handleInternalNavigation = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
    options: { scroll?: boolean } = {}
  ) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (href === currentHref) {
      return;
    }

    router.push(href, { scroll: options.scroll ?? false });
  };

  const activeContent = (() => {
    switch (activeTab) {
      case 'call-controls': {
        switch (activeSection.value) {
          case 'voice-preference':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      {t('ui.voicePreference.sectionTitle')}
                    </div>
                  }
                  description={t('ui.voicePreference.sectionDescription')}
                />
                <SectionBody className="gap-4">
                  <VoiceSelector
                    value={selectedVoice}
                    onChange={(value) => {
                      setSelectedVoice(value);
                      voiceAutoSave.triggerSave(value);
                    }}
                    disabled={disabled}
                  />
                </SectionBody>
              </Section>
            );
          case 'quiet-hours':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Quiet Hours
                    </div>
                  }
                  description="Ultaura will not make calls during these hours."
                />
                <SectionBody className="gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Start</label>
                      <Select value={quietHoursStart} onValueChange={(value) => {
                        setQuietHoursStart(value);
                        lineAutoSave.triggerSave(getLineFields({ quietHoursStart: value }));
                      }}>
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
                      <Select value={quietHoursEnd} onValueChange={(value) => {
                        setQuietHoursEnd(value);
                        lineAutoSave.triggerSave(getLineFields({ quietHoursEnd: value }));
                      }}>
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
                </SectionBody>
              </Section>
            );
          case 'voicemail':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Voicemail className="h-4 w-4 text-muted-foreground" />
                      Voicemail Settings
                    </div>
                  }
                  description="Choose what happens if a call goes to voicemail."
                />
                <SectionBody className="gap-4">
                  <RadioGroup
                    value={voicemailBehavior}
                    onValueChange={(value) => {
                      const v = value as VoicemailBehavior;
                      setVoicemailBehavior(v);
                      lineAutoSave.triggerSave(getLineFields({ voicemailBehavior: v }));
                    }}
                    className="gap-3"
                    disabled={disabled}
                  >
                    <RadioGroupItemLabel>
                      <RadioGroupItem value="none" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Don&apos;t leave a message
                        </p>
                        <p className="text-xs text-muted-foreground">Hang up quietly</p>
                      </div>
                    </RadioGroupItemLabel>
                    <RadioGroupItemLabel>
                      <RadioGroupItem value="brief" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Leave a brief message
                        </p>
                        <p className="text-xs text-muted-foreground">Leave a short message</p>
                      </div>
                    </RadioGroupItemLabel>
                    <RadioGroupItemLabel>
                      <RadioGroupItem value="detailed" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Leave a detailed message
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Include why I was calling
                        </p>
                      </div>
                    </RadioGroupItemLabel>
                  </RadioGroup>
                </SectionBody>
              </Section>
            );
          case 'inbound':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <PhoneIncoming className="h-4 w-4 text-muted-foreground" />
                      Inbound Calling
                    </div>
                  }
                  description={`Allow ${line.display_name} to call Ultaura any time.`}
                />
                <SectionBody className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-foreground">
                        Allow inbound calls
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        When enabled, {line.display_name} can call Ultaura to start a
                        conversation at any time. Disable to only receive scheduled calls.
                      </p>
                    </div>
                    <Switch
                      checked={inboundAllowed}
                      onCheckedChange={(checked) => {
                        setInboundAllowed(checked);
                        lineAutoSave.triggerSave(getLineFields({ inboundAllowed: checked }));
                      }}
                      disabled={disabled}
                    />
                  </div>
                </SectionBody>
              </Section>
            );
          case 'voice-controls':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      Voice Controls
                    </div>
                  }
                  description={`Let ${line.display_name} manage reminders and schedules by voice.`}
                />
                <SectionBody className="gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
                        Voice reminder control
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        When enabled, {line.display_name} can create, edit, pause, and cancel
                        reminders during phone calls.
                      </p>
                    </div>
                    <Switch
                      checked={allowVoiceReminderControl}
                      onCheckedChange={(checked) => {
                        setAllowVoiceReminderControl(checked);
                        lineAutoSave.triggerSave(getLineFields({ voiceReminderControl: checked }));
                      }}
                      disabled={disabled}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        Voice schedule control
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        When enabled, {line.display_name} can skip, snooze, or reschedule calls
                        during phone conversations.
                      </p>
                    </div>
                    <Switch
                      checked={allowVoiceScheduleControl}
                      onCheckedChange={(checked) => {
                        setAllowVoiceScheduleControl(checked);
                        lineAutoSave.triggerSave(getLineFields({ voiceScheduleControl: checked }));
                      }}
                      disabled={disabled}
                    />
                  </div>
                </SectionBody>
              </Section>
            );
          case 'vacation':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-muted-foreground" />
                      Vacation Mode
                    </div>
                  }
                  description={`Pause scheduled calls and reminders during vacations. Dates follow ${line.timezone}.`}
                />
                <SectionBody>
                  <VacationSettings
                    line={line}
                    ranges={vacationRanges}
                    lineId={line.id}
                    disabled={disabled}
                    showHeader={false}
                  />
                </SectionBody>
              </Section>
            );
          default:
            return null;
        }
      }
      case 'settings': {
        switch (activeSection.value) {
          case 'timezone':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Timezone
                    </div>
                  }
                  description="All call times and quiet hours use this timezone."
                />
                <SectionBody className="gap-4">
                  <Select value={effectiveTimezone} onValueChange={(value) => {
                    setTimezone(value);
                    lineAutoSave.triggerSave(getLineFields({ timezone: value }));
                  }}>
                    <SelectTrigger className="w-full py-3" disabled={disabled}>
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SectionBody>
              </Section>
            );
          case 'language': {
            const selectedOption = LANGUAGE_OPTIONS.find(
              (option) => option.value === preferredLanguage
            );
            const selectedLabel = selectedOption?.label ??
              (preferredLanguage ? getLanguageDisplayName(preferredLanguage) : 'Auto-detect');
            const showUnsupported = preferredLanguage !== null && !selectedOption;

            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      Language Preference
                    </div>
                  }
                  description="Set the language for calls with this line."
                />
                <SectionBody className="gap-4">
                  <Select
                    value={preferredLanguage ?? 'auto'}
                    onValueChange={(value) => {
                      const lang = value === 'auto' ? null : normalizeLanguageValue(value);
                      setPreferredLanguage(lang);
                      lineAutoSave.triggerSave(getLineFields({ language: lang }));
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full py-3">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {showUnsupported && preferredLanguage ? (
                        <SelectItem value={preferredLanguage} disabled>
                          {selectedLabel}
                        </SelectItem>
                      ) : null}
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value ?? 'auto'}
                          value={option.value ?? 'auto'}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {preferredLanguage === null ? (
                      <>
                        <p className="font-medium text-foreground">Auto-detect mode</p>
                        <p className="mt-1">
                          Ultaura will use a bilingual greeting on the first call and detect{' '}
                          {line.display_name}&apos;s preferred language from their response.
                          Once detected, the language will be saved automatically.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">{selectedLabel}</p>
                        <p className="mt-1">
                          Ultaura will start all calls in {selectedLabel}.
                          {line.display_name} can still switch languages during calls.
                        </p>
                      </>
                    )}
                  </div>
                </SectionBody>
              </Section>
            );
          }
          case 'insights-privacy':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      Insights & Privacy
                    </div>
                  }
                  description="Control how insights are generated and manage alert visibility."
                />
                <SectionBody className="gap-6">
                  <p className="text-sm text-muted-foreground">
                    Manage recording and family sharing consent in the{' '}
                    <Link
                      href="/dashboard/privacy"
                      className="text-primary hover:underline font-medium"
                    >
                      Privacy Center
                    </Link>
                  </p>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-foreground">
                        Enable call insights
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Summaries include mood, topics, and wellbeing notes. No transcripts are
                        stored.
                      </p>
                    </div>
                    {userType === 'self' ? (
                      <Switch
                        checked={insightsEnabled}
                        onCheckedChange={(checked) => {
                          setInsightsEnabled(checked);
                          insightAutoSave.triggerSave(checked);
                        }}
                        disabled={disabled}
                      />
                    ) : (
                      <span className={
                        'rounded-full px-2.5 py-1 text-xs font-medium ' +
                        (insightsEnabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground')
                      }>
                        {insightsEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
                  </div>

                  {userType !== 'self' && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {line.display_name} controls this setting. Request a change and we&apos;ll ask
                        on the next call.
                      </p>
                      {insightsRepromptRequested ? (
                        <p className="text-sm text-muted-foreground mt-1">Requested</p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestInsightsRePrompt}
                          disabled={disabled || isRequestingInsightsChange}
                          className="text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Request Change
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-foreground">
                        Pause insights and alerts
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Pause family-facing insights and alerts while still collecting call data.
                      </p>
                    </div>
                    <Switch
                      checked={isPaused}
                      onCheckedChange={(checked) => {
                        setIsPaused(checked);
                        pauseAutoSave.triggerSave({ isPaused: checked });
                      }}
                      disabled={disabled}
                    />
                  </div>
                </SectionBody>
              </Section>
            );
          case 'weekly-summary':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Weekly Summary
                    </div>
                  }
                  description="Receive a weekly email recap of calls, mood, and wellbeing notes."
                />
                <SectionBody className="gap-6">
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
                      onCheckedChange={(checked) => {
                        setWeeklySummaryEnabled(checked);
                        notifAutoSave.triggerSave(getNotifFields({ weeklySummaryEnabled: checked }));
                      }}
                      disabled={disabled}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Day</label>
                      <Select
                        value={weeklySummaryDay}
                        onValueChange={(value) => {
                          setWeeklySummaryDay(value);
                          notifAutoSave.triggerSave(getNotifFields({ weeklySummaryDay: value }));
                        }}
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
                        onValueChange={(value) => {
                          setWeeklySummaryTime(value);
                          notifAutoSave.triggerSave(getNotifFields({ weeklySummaryTime: value }));
                        }}
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
                </SectionBody>
              </Section>
            );
          case 'missed-calls':
            return (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                      Missed Call Alerts
                    </div>
                  }
                  description="Send an email when consecutive scheduled calls are missed."
                />
                <SectionBody className="gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-foreground">
                        Enable missed call alerts
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Alerts are sent to the billing email on your account.
                      </p>
                    </div>
                    <Switch
                      checked={missedCallsEnabled}
                      onCheckedChange={(checked) => {
                        setMissedCallsEnabled(checked);
                        notifAutoSave.triggerSave(getNotifFields({ missedCallsEnabled: checked }));
                      }}
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-foreground">
                        Alert after
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Current threshold: {missedCallsThreshold} missed calls.
                      </p>
                    </div>
                    <Select
                      value={String(missedCallsThreshold)}
                      onValueChange={(value) => {
                        const num = Number(value);
                        setMissedCallsThreshold(num);
                        notifAutoSave.triggerSave(getNotifFields({ missedCallsThreshold: num }));
                      }}
                      disabled={disabled || !missedCallsEnabled}
                    >
                      <SelectTrigger className="w-[10rem] py-3 shrink-0">
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
                </SectionBody>
              </Section>
            );
          case 'accessibility':
            return (
              <Section>
            <SectionHeader
              title={
                <div className="flex items-center gap-2">
                  <Ear className="w-4 h-4 text-muted-foreground" />
                  Accessibility Settings
                </div>
              }
              description="Adjust audio clarity and cognitive support preferences."
            />
            <SectionBody className="gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Hearing Mode</label>
                  <Select value={hearingMode} onValueChange={(value) => {
                    setHearingMode(value);
                    a11yAutoSave.triggerSave(getA11yFields({ hearingMode: value }));
                  }}>
                    <SelectTrigger className="w-full py-3" disabled={disabled}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="enhanced_clarity">Enhanced clarity</SelectItem>
                      <SelectItem value="slow_pace">Slow pace</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Cognitive Mode</label>
                  <Select value={cognitiveMode} onValueChange={(value) => {
                    setCognitiveMode(value);
                    a11yAutoSave.triggerSave(getA11yFields({ cognitiveMode: value }));
                  }}>
                    <SelectTrigger className="w-full py-3" disabled={disabled}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="supportive">Supportive</SelectItem>
                      <SelectItem value="high_support">High support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Accordion>
                <AccordionItem value="accessibility-advanced">
                  <AccordionTrigger>Advanced accessibility controls</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Speech Rate
                      </label>
                      <TextField.Input
                        type="number"
                        min={0.7}
                        max={1.3}
                        step={0.05}
                        value={speechRate}
                        onChange={(event) => {
                          const next = Number.parseFloat(event.target.value);
                          if (Number.isFinite(next)) {
                            setSpeechRate(next);
                            a11yAutoSave.triggerSave(getA11yFields({ speechRate: next }));
                          }
                        }}
                        disabled={disabled}
                      />
                      <p className="text-xs text-muted-foreground mt-1">1.0 is normal pace.</p>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Context Window (calls)
                      </label>
                      <TextField.Input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={contextWindowCalls}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value, 10);
                          if (Number.isFinite(next)) {
                            setContextWindowCalls(next);
                            a11yAutoSave.triggerSave(getA11yFields({ contextWindowCalls: next }));
                          }
                        }}
                        disabled={disabled}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        How many recent calls Ultaura can reference.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </SectionBody>
              </Section>
            );
          default:
            return null;
        }
      }
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-6 pb-24">
      <p className="text-sm text-muted-foreground">
        {activeTab === 'call-controls'
          ? 'Configure how Ultaura places and receives calls, including voice selection, quiet hours, and voicemail behavior.'
          : 'Customize how Ultaura communicates with your loved one, including timezone, language, accessibility options, and notification preferences.'}
      </p>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <LineSettingsSidebarNav
            lineShortId={line.short_id}
            groups={groupsForTab}
            sections={sectionsForTab}
            activeSection={activeSection}
            onNavigate={handleInternalNavigation}
            tab={activeTab}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {activeContent}
          </div>
        </div>
      </div>
    </div>
  );
}

function LineSettingsSidebarNav({
  lineShortId,
  tab,
  groups,
  sections,
  activeSection,
  onNavigate,
}: {
  lineShortId: string;
  tab: LineSettingsTabValue;
  groups: Array<{ label: string; sections: LineSettingsSectionConfig[] }>;
  sections: LineSettingsSectionConfig[];
  activeSection: LineSettingsSectionConfig;
  onNavigate: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
    options?: { scroll?: boolean }
  ) => void;
}) {
  const links = sections.map((section) => ({
    path: buildSettingsUrl(lineShortId, tab, section.value),
    label: section.label,
  }));

  return (
    <>
      <div className="hidden min-w-[12rem] lg:flex">
        <nav className="w-full">
          <ul className="flex flex-col space-y-4">
            {groups.map((group) => (
              <li key={group.label}>
                <div className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <ul className="mt-2 flex flex-col space-y-1.5">
                  {group.sections.map((section) => {
                    const isActive = section.value === activeSection.value;
                    const Icon = section.icon;
                    const href = buildSettingsUrl(lineShortId, tab, section.value);
                    return (
                      <li key={section.value}>
                        <Link
                          href={href}
                          scroll={false}
                          onClick={(event) => onNavigate(event, href, { scroll: false })}
                          className={classNames(
                            'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-primary'
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon
                            className={classNames(
                              'h-4 w-4',
                              isActive
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover:text-primary'
                            )}
                          />
                          <span>{section.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="block w-full lg:hidden">
        <MobileNavigationDropdown
          links={links}
          currentLabel={activeSection.label}
          onNavigate={(event, link) => onNavigate(event, link.path, { scroll: false })}
        />
      </div>
    </>
  );
}
