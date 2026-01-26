import { beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '~/app/api/telephony/weekly-summary/route';
import type { WeeklySummaryData } from '../types';
import { createTestAccount, createTestLine } from './setup';

vi.mock('~/core/email/send-email', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const renderWeeklySummaryEmail = vi.fn(() => '<html></html>');
vi.mock('~/lib/emails/weekly-summary', () => ({
  default: renderWeeklySummaryEmail,
}));

describe('weekly summary route', () => {
  beforeAll(() => {
    process.env.EMAIL_SENDER = 'test-sender@example.com';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  });

  it('normalizes sharingSummary account/line to the validated line', async () => {
    const { account } = await createTestAccount({ userType: 'self' });
    const line = await createTestLine(account.id);

    const summary: WeeklySummaryData = {
      lineId: line.id,
      lineName: line.display_name,
      accountId: account.id,
      billingEmail: account.billing_email,
      weekStartDate: '2026-01-01',
      weekEndDate: '2026-01-08',
      timezone: line.timezone,
      safetyEvents: [],
      usageSummary: {
        minutesUsed: 0,
        minutesRemaining: 300,
        overageMinutes: 0,
        overageCost: 0,
      },
      scheduledCalls: 1,
      answeredCalls: 1,
      missedCalls: 0,
      showMissedCallsWarning: false,
      answerTrend: 'stable',
      answerTrendValue: 0,
      avgDurationMinutes: 1,
      durationTrend: 'stable',
      durationTrendValue: 0,
      engagementNote: null,
      moodSummary: null,
      moodShiftNote: null,
      moodDistribution: null,
      socialNeedNote: null,
      topTopics: [],
      concerns: [],
      needsFollowUp: false,
      followUpReasons: [],
      isPaused: false,
      pausedNote: null,
      dashboardUrl: 'http://localhost:3000/dashboard/alerts',
      settingsUrl: 'http://localhost:3000/dashboard/settings',
    };

    const sharingSummary: WeeklySummaryData = {
      ...summary,
      accountId: 'other-account',
      lineId: 'other-line',
      lineName: 'Other Line',
    };

    const response = await POST(new Request('http://localhost/api/telephony/weekly-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.ULTAURA_INTERNAL_API_SECRET || 'test-secret',
      },
      body: JSON.stringify({ summary, sharingSummary }),
    }));

    expect(response.status).toBe(200);
    expect(renderWeeklySummaryEmail).toHaveBeenCalled();
    const firstCall = renderWeeklySummaryEmail.mock.calls[0]?.[0];
    expect(firstCall?.accountId).toBe(account.id);
    expect(firstCall?.lineId).toBe(line.id);
  });
});
