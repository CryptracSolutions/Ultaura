import { describe, expect, it } from 'vitest';
import type { WellnessAlert } from '../types';
import { redactAlertByTier } from '../alerts';

describe('redactAlertByTier', () => {
  const baseAlert: WellnessAlert = {
    id: 'alert-1',
    lineId: 'line-1',
    lineName: 'Test Line',
    createdAt: '2026-01-01T00:00:00.000Z',
    alertType: 'sleep_concern',
    severity: 'warning',
    title: 'Sleep concern detected',
    summary: 'They mentioned difficulty sleeping this week.',
    acknowledgedAt: null,
  };

  it('returns null for tier_1', () => {
    const result = redactAlertByTier(baseAlert, 'tier_1');
    expect(result).toBeNull();
  });

  it('redacts mood_drop for tier_2 and tier_3', () => {
    const moodAlert = { ...baseAlert, alertType: 'mood_drop' };
    const result = redactAlertByTier(moodAlert, 'tier_2');
    expect(result?.title).toBe('Mood change noted');
    expect(result?.summary).toBe('A mood trend was observed during recent calls.');
  });

  it('uses generic copy for tier_2 and tier_3 non-mood alerts', () => {
    const result = redactAlertByTier(baseAlert, 'tier_3');
    expect(result?.title).toBe('Wellness observation');
    expect(result?.summary).toBe('A wellness observation was noted. Consider checking in.');
  });

  it('returns full alert for tier_4', () => {
    const result = redactAlertByTier(baseAlert, 'tier_4');
    expect(result).toEqual(baseAlert);
  });
});
