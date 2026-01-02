import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  validateTimezone,
  validateTimezoneSupport,
  getNextOccurrence,
  getNextReminderOccurrence,
  localToUtc,
} from '../utils/timezone.js';

describe('timezone utilities', () => {
  describe('isValidTimezone', () => {
    it('returns true for valid IANA timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
      expect(isValidTimezone('Pacific/Honolulu')).toBe(true);
    });

    it('returns false for invalid timezones', () => {
      expect(isValidTimezone('America/NewYork')).toBe(false);
      expect(isValidTimezone('EST')).toBe(false);
      expect(isValidTimezone('GMT-5')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('validateTimezone', () => {
    it('throws for invalid timezone', () => {
      expect(() => validateTimezone('Invalid/Timezone')).toThrow('Invalid timezone');
    });
  });

  describe('getNextOccurrence', () => {
    it('calculates next occurrence for a simple case', () => {
      const result = getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/New_York',
        daysOfWeek: [1, 2, 3, 4, 5],
        afterDate: new Date('2025-01-06T16:00:00Z'),
      });

      expect(result.toISOString()).toBe('2025-01-07T14:00:00.000Z');
    });

    it('skips to the next matching weekday', () => {
      const result = getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/New_York',
        daysOfWeek: [1],
        afterDate: new Date('2025-01-07T17:00:00Z'),
      });

      expect(result.toISOString()).toBe('2025-01-13T14:00:00.000Z');
    });
  });

  describe('DST spring forward', () => {
    it('shifts skipped time forward to post-DST', () => {
      const result = getNextOccurrence({
        timeOfDay: '02:30',
        timezone: 'America/New_York',
        daysOfWeek: [0],
        afterDate: new Date('2025-03-08T12:00:00Z'),
      });

      expect(result.toISOString()).toBe('2025-03-09T07:30:00.000Z');
    });
  });

  describe('DST fall back', () => {
    it('uses second occurrence for ambiguous time', () => {
      const result = getNextOccurrence({
        timeOfDay: '01:30',
        timezone: 'America/New_York',
        daysOfWeek: [0],
        afterDate: new Date('2025-11-01T12:00:00Z'),
      });

      expect(result.toISOString()).toBe('2025-11-02T06:30:00.000Z');
    });
  });

  describe('edge cases', () => {
    it('throws on invalid timezone', () => {
      expect(() =>
        getNextOccurrence({
          timeOfDay: '09:00',
          timezone: 'Invalid/Timezone',
          daysOfWeek: [1],
        })
      ).toThrow('Invalid timezone');
    });

    it('throws on empty daysOfWeek', () => {
      expect(() =>
        getNextOccurrence({
          timeOfDay: '09:00',
          timezone: 'America/New_York',
          daysOfWeek: [],
        })
      ).toThrow('daysOfWeek must contain at least one day');
    });

    it('throws on invalid timeOfDay format', () => {
      expect(() =>
        getNextOccurrence({
          timeOfDay: '9:00',
          timezone: 'America/New_York',
          daysOfWeek: [1],
        })
      ).toThrow();
    });

    it('handles Arizona (no DST) correctly', () => {
      const result = getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/Phoenix',
        daysOfWeek: [0],
        afterDate: new Date('2025-03-08T12:00:00Z'),
      });

      expect(result.toISOString()).toBe('2025-03-09T16:00:00.000Z');
    });
  });

  describe('localToUtc', () => {
    it('uses the first occurrence for ambiguous times', () => {
      const result = localToUtc('2025-11-02T01:30:00', 'America/New_York');
      expect(result.toISOString()).toBe('2025-11-02T05:30:00.000Z');
    });
  });

  describe('getNextReminderOccurrence', () => {
    it('calculates daily recurrence', () => {
      const result = getNextReminderOccurrence({
        rrule: 'FREQ=DAILY',
        timezone: 'America/New_York',
        timeOfDay: '08:00',
        currentDueAt: new Date('2025-01-06T13:00:00Z'),
      });

      expect(result?.toISOString()).toBe('2025-01-07T13:00:00.000Z');
    });

    it('respects INTERVAL in daily', () => {
      const result = getNextReminderOccurrence({
        rrule: 'FREQ=DAILY;INTERVAL=3',
        timezone: 'America/New_York',
        timeOfDay: '08:00',
        currentDueAt: new Date('2025-01-06T13:00:00Z'),
      });

      expect(result?.toISOString()).toBe('2025-01-09T13:00:00.000Z');
    });
  });

  describe('validateTimezoneSupport', () => {
    it('passes for all US timezones', () => {
      expect(() =>
        validateTimezoneSupport([
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Phoenix',
          'America/Los_Angeles',
          'America/Anchorage',
          'Pacific/Honolulu',
        ])
      ).not.toThrow();
    });

    it('throws for invalid timezone in list', () => {
      expect(() =>
        validateTimezoneSupport([
          'America/New_York',
          'Invalid/Zone',
        ])
      ).toThrow('Timezone support check failed');
    });
  });
});
