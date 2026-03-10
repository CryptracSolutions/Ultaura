import {
  Heading,
  Section,
  Text,
  render,
} from '@react-email/components';

import type { WeeklySummaryData } from '~/lib/ultaura/types';
import { brandColors } from '~/lib/brand-colors';
import { EmailLayout } from '~/lib/emails/components/email-layout';

function formatSignedDelta(value: number, unit?: string): string {
  const sign = value > 0 ? `+${value}` : `${value}`;
  return `(${sign}${unit ?? ''} vs last week)`;
}

function formatTrendLabel(value: number | null, unit?: string): string | null {
  if (value === null) return null;
  return formatSignedDelta(value, unit);
}

function titleCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type WeeklySummaryEmailProps = WeeklySummaryData & {
  isSelfRecipient?: boolean;
  isPrimaryRecipient?: boolean;
  hasDashboardAccess?: boolean;
  unsubscribeLink?: string;
};

export default function renderWeeklySummaryEmail(summary: WeeklySummaryEmailProps): { html: string; text: string } {
  const previewText = summary.isSelfRecipient
    ? 'Your weekly check-in summary'
    : `Weekly check-in summary for ${summary.lineName}`;
  const answerTrendLabel = formatTrendLabel(summary.answerTrendValue);
  const durationTrendLabel =
    summary.avgDurationMinutes === null ? null : formatTrendLabel(summary.durationTrendValue, 'm');
  const followUpText = summary.followUpReasons.join(', ');
  const avgDurationLabel =
    summary.avgDurationMinutes === null ? 'N/A' : `${summary.avgDurationMinutes}m`;
  const greeting = summary.isSelfRecipient
    ? 'Here is your weekly summary.'
    : `Here is the weekly summary for ${summary.lineName}.`;
  const effectiveTier = summary.isSelfRecipient ? 'tier_4' : summary.sharingTier || 'tier_1';
  const allowMood = summary.isSelfRecipient || effectiveTier !== 'tier_1';
  const allowTopics = summary.isSelfRecipient || effectiveTier === 'tier_3' || effectiveTier === 'tier_4';
  const allowConcerns = summary.isSelfRecipient || effectiveTier === 'tier_4';

  const footerLinks: Array<{ label: string; href: string }> = [];
  if (summary.isPrimaryRecipient || summary.hasDashboardAccess) {
    footerLinks.push({ label: 'Manage notifications', href: summary.settingsUrl });
  }
  if (summary.unsubscribeLink && !summary.isPrimaryRecipient) {
    footerLinks.push({ label: 'Unsubscribe', href: summary.unsubscribeLink });
  }

  const jsx = (
    <EmailLayout preview={previewText} aiDisclaimer={true} footerLinks={footerLinks}>
      <Heading className="text-[22px] font-semibold text-stone-900 m-0 text-center">
        Weekly Check-in Summary
      </Heading>
      <Text className="text-[14px] text-stone-500 mt-[6px] mb-0 text-center">
        {summary.lineName} — Week of {summary.weekStartDate} to {summary.weekEndDate}
      </Text>

      <Text className="text-[14px] text-stone-700 mt-[16px] mb-0">
        {greeting}
      </Text>

      {!summary.isPrimaryRecipient && !summary.hasDashboardAccess ? (
        <Text className="text-[14px] text-stone-700 mt-[12px] mb-0">
          You are receiving email updates only. If you&apos;d like dashboard access,
          please contact the account holder to activate it.
        </Text>
      ) : null}

      {summary.isPaused ? (
        <Section className="mt-[16px] bg-stone-100 rounded-lg px-[14px] py-[12px]">
          <Text className="text-[13px] text-stone-700 m-0">
            {summary.pausedNote || 'Calls are currently paused for this line.'}
          </Text>
        </Section>
      ) : null}

      <Section className="mt-[20px]">
        <Heading className="text-[16px] font-semibold text-stone-900 m-0">
          Call Activity
        </Heading>
        <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
          Calls answered: {summary.answeredCalls}/{summary.scheduledCalls} scheduled{' '}
          {answerTrendLabel ? answerTrendLabel : ''}
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          Average duration: {avgDurationLabel}
          {durationTrendLabel ? ` ${durationTrendLabel}` : ''}
        </Text>
        {summary.showMissedCallsWarning ? (
          <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
            Missed calls: {summary.missedCalls}
          </Text>
        ) : null}
      </Section>

      <Section className="mt-[18px]">
        <Heading className="text-[16px] font-semibold text-stone-900 m-0">
          Safety Alerts
        </Heading>
        {summary.safetyEvents.length > 0 ? (
          <Section className="mt-[8px]">
            {summary.safetyEvents.map((event, index) => (
              <Text key={`${event.timestamp}-${index}`} className="text-[14px] text-stone-700 m-0">
                {formatDateLabel(event.timestamp)}: High alert
                {event.actionTaken ? ` (${event.actionTaken})` : ''}
              </Text>
            ))}
          </Section>
        ) : (
          <Text className="text-[14px] text-stone-500 mt-[8px] mb-0">
            No high-tier safety alerts this week.
          </Text>
        )}
      </Section>

      <Section className="mt-[18px]">
        <Heading className="text-[16px] font-semibold text-stone-900 m-0">
          Usage
        </Heading>
        <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
          Minutes used: {summary.usageSummary.minutesUsed}
        </Text>
        <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
          Minutes remaining: {summary.usageSummary.minutesRemaining}
        </Text>
        {summary.usageSummary.overageMinutes > 0 ? (
          <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
            Overage: {summary.usageSummary.overageMinutes} min ($
            {summary.usageSummary.overageCost.toFixed(2)})
          </Text>
        ) : null}
      </Section>

      {allowMood && summary.engagementNote ? (
        <Section className="mt-[18px]">
          <Heading className="text-[16px] font-semibold text-stone-900 m-0">
            Engagement
          </Heading>
          <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
            Engagement has been lower than typical ({summary.engagementNote}).
          </Text>
        </Section>
      ) : null}

      {allowMood && summary.moodSummary ? (
        <Section className="mt-[18px]">
          <Heading className="text-[16px] font-semibold text-stone-900 m-0">
            Mood This Week
          </Heading>
          <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
            {summary.moodSummary}
          </Text>
          {summary.moodShiftNote ? (
            <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
              {summary.moodShiftNote}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {allowConcerns && summary.socialNeedNote ? (
        <Section className="mt-[18px]">
          <Heading className="text-[16px] font-semibold text-stone-900 m-0">
            Social Connection
          </Heading>
          <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
            {summary.socialNeedNote}
          </Text>
        </Section>
      ) : null}

      {allowTopics ? (
        <Section className="mt-[18px]">
          <Heading className="text-[16px] font-semibold text-stone-900 m-0">
            Topics Discussed
          </Heading>
          {summary.topTopics.length > 0 ? (
            <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
              {summary.topTopics.map((topic) => (
                <span
                  key={topic.code}
                  style={{
                    display: 'inline-block',
                    backgroundColor: brandColors.stone[100],
                    color: brandColors.stone[700],
                    padding: '4px 10px',
                    borderRadius: '999px',
                    marginRight: '6px',
                    marginBottom: '6px',
                    fontSize: '12px',
                  }}
                >
                  {topic.label}
                </span>
              ))}
            </Text>
          ) : (
            <Text className="text-[14px] text-stone-500 mt-[8px] mb-0">
              No topics captured this week.
            </Text>
          )}
        </Section>
      ) : null}

      {allowConcerns ? (
        <Section className="mt-[18px]">
          <Heading className="text-[16px] font-semibold text-stone-900 m-0">
            Wellbeing Notes
          </Heading>
          {summary.concerns.length > 0 ? (
            summary.concerns.map((concern) => {
              const noveltyLabel = titleCase(concern.novelty);
              const severityText =
                concern.novelty === 'resolved'
                  ? ` (was ${concern.severity})`
                  : ` (${concern.severity})`;
              return (
                <Text
                  key={`${concern.code}-${concern.novelty}`}
                  className="text-[14px] text-stone-700 mt-[6px] mb-0"
                >
                  {noveltyLabel}: {concern.label}
                  {severityText}
                </Text>
              );
            })
          ) : (
            <Text className="text-[14px] text-stone-500 mt-[8px] mb-0">
              No wellbeing concerns detected this week.
            </Text>
          )}
        </Section>
      ) : null}

      {allowConcerns && summary.needsFollowUp && followUpText ? (
        <Section className="mt-[18px] bg-stone-100 rounded-lg px-[14px] py-[12px]">
          <Heading className="text-[15px] font-semibold text-stone-900 m-0">
            Follow-up Suggested
          </Heading>
          <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
            Based on this week&apos;s patterns, consider checking in about: {followUpText}
          </Text>
        </Section>
      ) : null}
    </EmailLayout>
  );

  return { html: render(jsx), text: render(jsx, { plainText: true }) };
}
