import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
  Link,
  render,
} from '@react-email/components';

import type { WeeklySummaryData } from '~/lib/ultaura/types';
import { brandColors } from '~/lib/brand-colors';

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

export default function renderWeeklySummaryEmail(summary: WeeklySummaryData) {
  const previewText = `Weekly check-in summary for ${summary.lineName}`;
  const answerTrendLabel = formatTrendLabel(summary.answerTrendValue);
  const durationTrendLabel = formatTrendLabel(summary.durationTrendValue, 'm');
  const followUpText = summary.followUpReasons.join(', ');

  return render(
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Tailwind>
        <Body className="bg-stone-50 my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#e7e5e4] rounded-lg my-[32px] mx-auto p-[24px] w-[600px] bg-white">
            <Section
              className="text-center rounded-lg py-[16px] px-[12px]"
              style={{ backgroundColor: brandColors.primary }}
            >
              <Heading className="text-white text-[22px] font-semibold m-0">
                Weekly Check-in Summary
              </Heading>
              <Text className="text-white text-[14px] mt-[6px] mb-0">
                {summary.lineName} - Week of {summary.weekStartDate} to {summary.weekEndDate}
              </Text>
            </Section>

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
                Average duration: {summary.avgDurationMinutes}m{' '}
                {durationTrendLabel ? durationTrendLabel : ''}
              </Text>
              {summary.showMissedCallsWarning ? (
                <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
                  Missed calls: {summary.missedCalls}
                </Text>
              ) : null}
            </Section>

            {summary.engagementNote ? (
              <Section className="mt-[18px]">
                <Heading className="text-[16px] font-semibold text-stone-900 m-0">
                  Engagement
                </Heading>
                <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
                  Engagement has been lower than typical ({summary.engagementNote}).
                </Text>
              </Section>
            ) : null}

            {summary.moodSummary ? (
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

            {summary.socialNeedNote ? (
              <Section className="mt-[18px]">
                <Heading className="text-[16px] font-semibold text-stone-900 m-0">
                  Social Connection
                </Heading>
                <Text className="text-[14px] text-stone-700 mt-[8px] mb-0">
                  {summary.socialNeedNote}
                </Text>
              </Section>
            ) : null}

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

            {summary.concerns.length > 0 ? (
              <Section className="mt-[18px]">
                <Heading className="text-[16px] font-semibold text-stone-900 m-0">
                  Wellbeing Notes
                </Heading>
                {summary.concerns.map((concern) => {
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
                })}
              </Section>
            ) : null}

            {summary.needsFollowUp && followUpText ? (
              <Section className="mt-[18px] bg-orange-50 rounded-lg px-[14px] py-[12px]">
                <Heading className="text-[15px] font-semibold text-stone-900 m-0">
                  Follow-up Suggested
                </Heading>
                <Text className="text-[14px] text-stone-700 mt-[6px] mb-0">
                  Based on this week&apos;s patterns, consider checking in about: {followUpText}
                </Text>
              </Section>
            ) : null}

            <Hr className="border border-solid border-[#e7e5e4] my-[20px] mx-0 w-full" />

            <Section className="text-center">
              <Text className="text-[12px] text-stone-500 m-0">
                These insights are generated by AI and are not medical or clinical advice.
              </Text>
              <Text className="text-[12px] text-stone-500 mt-[4px] mb-0">
                For emergencies, contact local emergency services.
              </Text>
              <Text className="text-[12px] text-stone-500 mt-[8px] mb-0">
                <Link
                  href={summary.settingsUrl}
                  style={{ color: brandColors.primary }}
                >
                  Manage notification preferences
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>,
  );
}
