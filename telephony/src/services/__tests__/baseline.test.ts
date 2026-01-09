import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  calculateAnswerRateFromSessions,
  calculateMoodDistribution,
  getBaselineWindow,
  isCallAnswered,
} from '../baseline.js';

describe('baseline helpers', () => {
  it('calculates mood distribution fractions', () => {
    const insights = [
      { mood_overall: 'positive' },
      { mood_overall: 'positive' },
      { mood_overall: 'low' },
    ] as any;

    const distribution = calculateMoodDistribution(insights);

    expect(distribution.positive).toBeCloseTo(2 / 3, 5);
    expect(distribution.neutral).toBeCloseTo(0, 5);
    expect(distribution.low).toBeCloseTo(1 / 3, 5);
  });

  it('handles empty mood distribution', () => {
    const distribution = calculateMoodDistribution([]);
    expect(distribution).toEqual({ positive: 0, neutral: 0, low: 0 });
  });

  it('calculates answer rate from sessions', () => {
    const sessions = [
      { answered_by: 'human', seconds_connected: 120 },
      { answered_by: 'unknown', seconds_connected: 0 },
      { answered_by: null, seconds_connected: 10 },
      { answered_by: 'machine_start', seconds_connected: 0 },
    ];

    expect(calculateAnswerRateFromSessions(sessions)).toBeCloseTo(3 / 4, 5);
  });

  it('detects answered calls correctly', () => {
    expect(isCallAnswered({ answered_by: 'human', seconds_connected: 0 })).toBe(true);
    expect(isCallAnswered({ answered_by: 'unknown', seconds_connected: 0 })).toBe(true);
    expect(isCallAnswered({ answered_by: null, seconds_connected: 5 })).toBe(true);
    expect(isCallAnswered({ answered_by: 'machine_start', seconds_connected: 0 })).toBe(false);
  });

  it('builds the correct baseline window', () => {
    const now = DateTime.fromISO('2025-01-15T12:00:00', { zone: 'America/New_York' });
    const { weekStart, weekEnd, baselineStart, baselineEnd } = getBaselineWindow('America/New_York', now);

    expect(weekEnd.toISODate()).toBe('2025-01-15');
    expect(weekStart.toISODate()).toBe('2025-01-08');
    expect(baselineEnd.toISODate()).toBe('2025-01-08');
    expect(baselineStart.toISODate()).toBe('2024-12-25');
  });
});
