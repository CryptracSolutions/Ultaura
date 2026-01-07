import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { getNextOccurrence } from '../timezone';

describe('schedules DST handling', () => {
  it('shifts forward during spring DST gap', () => {
    const afterDate = DateTime.fromISO('2024-03-10T01:00:00', {
      zone: 'America/New_York',
    }).toJSDate();

    const result = getNextOccurrence({
      timeOfDay: '02:30',
      timezone: 'America/New_York',
      daysOfWeek: [0],
      afterDate,
    });

    const local = DateTime.fromJSDate(result).setZone('America/New_York');
    expect(local.hour).toBe(3);
    expect(local.minute).toBe(30);
    expect(local.day).toBe(10);
  });

  it('prefers the later occurrence during fall DST ambiguity', () => {
    const afterDate = DateTime.fromISO('2024-11-03T00:30:00', {
      zone: 'America/New_York',
    }).toJSDate();

    const result = getNextOccurrence({
      timeOfDay: '01:30',
      timezone: 'America/New_York',
      daysOfWeek: [0],
      afterDate,
    });

    const local = DateTime.fromJSDate(result).setZone('America/New_York');
    expect(local.hour).toBe(1);
    expect(local.minute).toBe(30);
    expect(local.isInDST).toBe(false);
  });

  it('keeps consistent times in a non-DST timezone', () => {
    const summerDate = DateTime.fromISO('2024-07-15T08:00:00', {
      zone: 'America/Phoenix',
    }).toJSDate();
    const winterDate = DateTime.fromISO('2024-12-15T08:00:00', {
      zone: 'America/Phoenix',
    }).toJSDate();

    const summer = getNextOccurrence({
      timeOfDay: '09:00',
      timezone: 'America/Phoenix',
      daysOfWeek: [1, 2, 3, 4, 5],
      afterDate: summerDate,
    });

    const winter = getNextOccurrence({
      timeOfDay: '09:00',
      timezone: 'America/Phoenix',
      daysOfWeek: [1, 2, 3, 4, 5],
      afterDate: winterDate,
    });

    expect(DateTime.fromJSDate(summer).setZone('America/Phoenix').hour).toBe(9);
    expect(DateTime.fromJSDate(winter).setZone('America/Phoenix').hour).toBe(9);
  });
});
