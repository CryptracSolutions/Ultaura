'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { Button } from '~/core/ui/Button';
import { useTranslation } from 'react-i18next';
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
import { addVacationRange, removeVacationRange } from '~/lib/ultaura/vacation';
import { parseVacationRanges, type VacationRange } from '~/lib/ultaura/vacation-utils';
import { VacationSettings } from './VacationSettings';
import { getLanguageDisplayName } from '~/lib/ultaura/language';
import { DEFAULT_GROK_VOICE, type GrokVoice, isGrokVoice } from '~/lib/ultaura/voices';
import { VoiceSelector } from './components/VoiceSelector';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigationConfirmOpen, setNavigationConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    href: string;
    scroll?: boolean;
  } | null>(null);

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
  const initialPreferredLanguage = canonicalLinePreferredLanguage;
  const [timezone, setTimezone] = useState(line.timezone);
  const [quietHoursStart, setQuietHoursStart] = useState(
    normalizeTimeValue(line.quiet_hours_start)
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    normalizeTimeValue(line.quiet_hours_end)
  );
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(
    initialPreferredLanguage
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
  const initialVacationRanges = useMemo(
    () => parseVacationRanges(line.vacation_ranges),
    [line.vacation_ranges]
  );
  const [vacationRanges, setVacationRanges] = useState<VacationRange[]>(
    initialVacationRanges
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
    paused_reason: insightPrivacy?.paused_reason ?? '',
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

  const handlePauseToggle = (checked: boolean) => {
    setIsPaused(checked);
    if (!checked) {
      setPausedReason('');
    }
  };

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

  const resetFormState = () => {
    setTimezone(line.timezone);
    setQuietHoursStart(normalizeTimeValue(line.quiet_hours_start));
    setQuietHoursEnd(normalizeTimeValue(line.quiet_hours_end));
    setPreferredLanguage(initialPreferredLanguage);
    setAllowVoiceReminderControl(line.allow_voice_reminder_control ?? true);
    setAllowVoiceScheduleControl(line.allow_voice_schedule_control ?? true);
    setInboundAllowed(line.inbound_allowed ?? true);
    setVoicemailBehavior((line.voicemail_behavior || 'brief') as VoicemailBehavior);
    setVacationRanges(initialVacationRanges);
    setInsightsEnabled(privacyDefaults.insights_enabled);
    setInsightsRepromptRequested(Boolean(voiceConsent?.insightsRepromptRequestedAt));
    setIsPaused(privacyDefaults.is_paused);
    setPausedReason(privacyDefaults.paused_reason || '');
    setWeeklySummaryEnabled(notificationDefaults.weekly_summary_enabled);
    setWeeklySummaryDay(notificationDefaults.weekly_summary_day);
    setWeeklySummaryTime(notificationDefaults.weekly_summary_time);
    setMissedCallsEnabled(notificationDefaults.alert_missed_calls_enabled);
    setMissedCallsThreshold(notificationDefaults.alert_missed_calls_threshold);
    setHearingMode(accessibilityDefaults.hearing_mode);
    setSpeechRate(accessibilityDefaults.speech_rate);
    setCognitiveMode(accessibilityDefaults.cognitive_mode);
    setContextWindowCalls(accessibilityDefaults.context_window_calls);
    setSelectedVoice(initialVoice);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const normalizedPreferredLanguage = normalizeLanguageValue(preferredLanguage);
      if (hasLineChanges) {
        const result = await updateLine(line.id, {
          timezone: effectiveTimezone,
          quietHoursStart: normalizeTimeValue(quietHoursStart),
          quietHoursEnd: normalizeTimeValue(quietHoursEnd),
          allowVoiceReminderControl,
          allowVoiceScheduleControl,
          inboundAllowed,
          voicemailBehavior,
          preferredLanguageIso: normalizedPreferredLanguage,
        });

        if (!result.success) {
          setError(result.error.message || 'Failed to update line settings');
          return;
        }
      }

      if (hasVoiceChanges) {
        const result = await updateLine(line.id, {
          preferredGrokVoice: selectedVoice,
        });

        if (!result.success) {
          setError(result.error.message || 'Failed to update voice preference');
          return;
        }
      }

      if (hasVacationChanges) {
        const rangeKey = (range: VacationRange) => `${range.start}|${range.end}`;
        const initialKeys = new Set(initialVacationRanges.map(rangeKey));
        const currentKeys = new Set(vacationRanges.map(rangeKey));
        const rangesToRemove = initialVacationRanges.filter(
          (range) => !currentKeys.has(rangeKey(range))
        );
        const rangesToAdd = vacationRanges.filter(
          (range) => !initialKeys.has(rangeKey(range))
        );

        for (const range of rangesToRemove) {
          const result = await removeVacationRange(line.id, range.start);
          if (!result.success) {
            setError(result.error.message || 'Failed to remove vacation range');
            return;
          }
        }

        for (const range of rangesToAdd) {
          const result = await addVacationRange(line.id, range);
          if (!result.success) {
            setError(result.error.message || 'Failed to add vacation range');
            return;
          }
        }
      }

      if (hasInsightPrivacyChanges) {
        await updateInsightPrivacy(line.id, {
          insights_enabled: insightsEnabled,
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

      if (hasAccessibilityChanges) {
        const result = await updateAccessibilitySettings(line.id, {
          hearingMode,
          speechRate,
          cognitiveMode,
          contextWindowCalls,
        });
        if (!result.success) {
          setError(result.error.message || 'Failed to update accessibility settings');
          return;
        }
      }

      toast.success('Settings saved');
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeRanges = (ranges: VacationRange[]) =>
    [...ranges].map((range) => `${range.start}|${range.end}`).sort().join('|');

  const normalizedPreferredLanguage = normalizeLanguageValue(preferredLanguage);
  const hasLineChanges =
    effectiveTimezone !== line.timezone ||
    quietHoursStart !== normalizeTimeValue(line.quiet_hours_start) ||
    quietHoursEnd !== normalizeTimeValue(line.quiet_hours_end) ||
    normalizedPreferredLanguage !== canonicalLinePreferredLanguage ||
    allowVoiceReminderControl !== (line.allow_voice_reminder_control ?? true) ||
    allowVoiceScheduleControl !== (line.allow_voice_schedule_control ?? true) ||
    inboundAllowed !== (line.inbound_allowed ?? true) ||
    voicemailBehavior !== (line.voicemail_behavior || 'brief');

  const canEditInsightsEnabled = userType === 'self';
  const hasInsightPrivacyChanges =
    canEditInsightsEnabled && insightsEnabled !== privacyDefaults.insights_enabled;

  const hasPauseChanges =
    isPaused !== privacyDefaults.is_paused ||
    (isPaused && pausedReason.trim() !== (privacyDefaults.paused_reason || '').trim());

  const hasNotificationChanges =
    weeklySummaryEnabled !== notificationDefaults.weekly_summary_enabled ||
    weeklySummaryDay !== notificationDefaults.weekly_summary_day ||
    weeklySummaryTime !== notificationDefaults.weekly_summary_time ||
    missedCallsEnabled !== notificationDefaults.alert_missed_calls_enabled ||
    missedCallsThreshold !== notificationDefaults.alert_missed_calls_threshold;

  const hasVacationChanges =
    normalizeRanges(vacationRanges) !== normalizeRanges(initialVacationRanges);

  const hasAccessibilityChanges =
    hearingMode !== accessibilityDefaults.hearing_mode ||
    speechRate !== accessibilityDefaults.speech_rate ||
    cognitiveMode !== accessibilityDefaults.cognitive_mode ||
    contextWindowCalls !== accessibilityDefaults.context_window_calls;

  const hasVoiceChanges = selectedVoice !== initialVoice;

  const hasSaveableChanges =
    hasLineChanges ||
    hasVacationChanges ||
    hasInsightPrivacyChanges ||
    hasPauseChanges ||
    hasNotificationChanges ||
    hasAccessibilityChanges ||
    hasVoiceChanges;

  const hasChanges = hasSaveableChanges;

  const shouldWarnOnNavigate = hasChanges && !isLoading;
  const tabParam = searchParams.get('tab') as LineSettingsTabValue | null;
  const activeTab: { value: LineSettingsTabValue } = {
    value: tabParam ?? 'settings',
  };
  const lineSettingsSections = useMemo(
    () => buildLineSettingsSections(t('ui.voicePreference.sectionLabel')),
    [t]
  );
  const groupsForTab = lineSettingsSections[activeTab.value].groups;
  const sectionsForTab = useMemo(
    () => groupsForTab.flatMap((group) => group.sections),
    [groupsForTab]
  );
  const sectionParam = searchParams.get('section') as LineSettingsSectionValue | null;
  const activeSection =
    sectionsForTab.find((section) => section.value === sectionParam) ??
    sectionsForTab[0];
  const activeTabValue = activeTab.value;
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

  const handleExitNavigation = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
    options: { scroll?: boolean } = {}
  ) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (href === currentHref) {
      return;
    }

    if (shouldWarnOnNavigate) {
      setPendingNavigation({ href, scroll: options.scroll ?? false });
      setNavigationConfirmOpen(true);
      return;
    }

    router.push(href, { scroll: options.scroll ?? false });
  };

  const handleConfirmNavigation = () => {
    if (!pendingNavigation) {
      setNavigationConfirmOpen(false);
      return;
    }

    resetFormState();
    router.push(pendingNavigation.href, {
      scroll: pendingNavigation.scroll ?? false,
    });
    setPendingNavigation(null);
    setNavigationConfirmOpen(false);
  };

  const handleNavigationDialogChange = (open: boolean) => {
    setNavigationConfirmOpen(open);
    if (!open) {
      setPendingNavigation(null);
    }
  };

  useEffect(() => {
    if (!shouldWarnOnNavigate) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldWarnOnNavigate]);

  useEffect(() => {
    if (!shouldWarnOnNavigate) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (navigationConfirmOpen) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      const hrefAttr = anchor.getAttribute('href');
      if (!hrefAttr || hrefAttr.startsWith('#')) return;

      const targetAttr = anchor.getAttribute('target');
      if (targetAttr && targetAttr !== '_self') return;

      const url = new URL(hrefAttr, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname) return;

      event.preventDefault();
      setPendingNavigation({
        href: `${url.pathname}${url.search}${url.hash}`,
        scroll: false,
      });
      setNavigationConfirmOpen(true);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [navigationConfirmOpen, pathname, shouldWarnOnNavigate]);

  const activeContent = (() => {
    switch (activeTabValue) {
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
                    onChange={setSelectedVoice}
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
                    onValueChange={(value) => setVoicemailBehavior(value as VoicemailBehavior)}
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
                      onCheckedChange={setInboundAllowed}
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
                <SectionBody className="gap-4">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Voice reminder control is {allowVoiceReminderControl ? 'enabled' : 'disabled'}
                    . Voice schedule control is {allowVoiceScheduleControl ? 'enabled' : 'disabled'}.
                  </div>
                  <Accordion>
                    <AccordionItem value="voice-controls-advanced">
                      <AccordionTrigger>Advanced voice controls</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Bell className="w-4 h-4 text-muted-foreground" />
                              Voice reminder control
                            </label>
                            <p className="text-sm text-muted-foreground mt-1">
                              When enabled, {line.display_name} can create, edit, pause, and
                              cancel reminders during phone calls.
                            </p>
                          </div>
                          <Switch
                            checked={allowVoiceReminderControl}
                            onCheckedChange={setAllowVoiceReminderControl}
                            disabled={disabled}
                          />
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              Voice schedule control
                            </label>
                            <p className="text-sm text-muted-foreground mt-1">
                              When enabled, {line.display_name} can skip, snooze, or reschedule
                              calls during phone conversations.
                            </p>
                          </div>
                          <Switch
                            checked={allowVoiceScheduleControl}
                            onCheckedChange={setAllowVoiceScheduleControl}
                            disabled={disabled}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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
                    onRangesChange={setVacationRanges}
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
                  <Select value={effectiveTimezone} onValueChange={setTimezone}>
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
                    onValueChange={(value) =>
                      setPreferredLanguage(
                        value === 'auto' ? null : normalizeLanguageValue(value)
                      )
                    }
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
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    Manage recording and family sharing consent in the{' '}
                    <Link href="/dashboard/privacy" className="text-primary hover:underline">
                      Privacy Center
                    </Link>
                    .
                  </div>

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
                        onCheckedChange={setInsightsEnabled}
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
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                          {line.display_name} controls this setting. Request a change and we&apos;ll ask on the next call.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRequestInsightsRePrompt}
                          disabled={disabled || insightsRepromptRequested || isRequestingInsightsChange}
                          className="shrink-0"
                        >
                          {insightsRepromptRequested ? 'Requested' : 'Request Change'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Accordion>
                    <AccordionItem value="insights-advanced">
                      <AccordionTrigger>Advanced insight controls</AccordionTrigger>
                      <AccordionContent className="space-y-6">
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
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
                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                              />
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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
                      onCheckedChange={setMissedCallsEnabled}
                      disabled={disabled}
                    />
                  </div>

                  <Accordion>
                    <AccordionItem value="missed-calls-advanced">
                      <AccordionTrigger>Advanced alert thresholds</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div className="max-w-xs">
                          <label className="text-xs text-muted-foreground block mb-1">
                            Alert after
                          </label>
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
                        <p className="text-xs text-muted-foreground">
                          Current threshold: {missedCallsThreshold} missed calls.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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
                  <Select value={hearingMode} onValueChange={setHearingMode}>
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
                  <Select value={cognitiveMode} onValueChange={setCognitiveMode}>
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
                      <input
                        type="number"
                        min={0.7}
                        max={1.3}
                        step={0.05}
                        value={speechRate}
                        onChange={(event) => {
                          const next = Number.parseFloat(event.target.value);
                          if (Number.isFinite(next)) {
                            setSpeechRate(next);
                          }
                        }}
                        disabled={disabled}
                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">1.0 is normal pace.</p>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        Context Window (calls)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={contextWindowCalls}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value, 10);
                          if (Number.isFinite(next)) {
                            setContextWindowCalls(next);
                          }
                        }}
                        disabled={disabled}
                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
      {/* Tab description note */}
      <p className="text-sm text-muted-foreground">
        {activeTabValue === 'call-controls'
          ? 'Configure how Ultaura places and receives calls, including voice selection, quiet hours, and voicemail behavior.'
          : 'Customize how Ultaura communicates with your loved one, including timezone, language, accessibility options, and notification preferences.'}
      </p>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <LineSettingsSidebarNav
            lineShortId={line.short_id}
            groups={groupsForTab}
            sections={sectionsForTab}
            activeSection={activeSection}
            onNavigate={handleInternalNavigation}
            tab={activeTab.value}
          />
          <div className="flex w-full flex-col gap-6 lg:max-w-4xl">
            {activeContent}
          </div>
        </div>

        <div className="mt-6 flex gap-3 pt-2">
          <button
            type="button"
            onClick={resetFormState}
            disabled={disabled || isLoading || !hasSaveableChanges}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard changes
          </button>
          <button
            type="submit"
            disabled={disabled || isLoading || !hasSaveableChanges}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      <ConfirmationDialog
        open={navigationConfirmOpen}
        onOpenChange={handleNavigationDialogChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={handleConfirmNavigation}
      />
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
