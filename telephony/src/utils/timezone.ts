import { DateTime, IANAZone } from 'luxon';
import { logger } from './logger.js';

const TIME_OF_DAY_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;
const LOCAL_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

interface ParsedTimeOfDay {
  hour: number;
  minute: number;
  second: number;
  normalized: string;
}

interface ParsedLocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface BuildDateTimeParams {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timezone: string;
  preferLateAmbiguous: boolean;
  operation: string;
}

function parseTimeOfDay(timeOfDay: string): ParsedTimeOfDay {
  if (!TIME_OF_DAY_REGEX.test(timeOfDay)) {
    throw new Error(`Invalid timeOfDay format: "${timeOfDay}". Expected "HH:mm".`);
  }

  const [hourStr, minuteStr, secondStr = '00'] = timeOfDay.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour in timeOfDay: "${timeOfDay}".`);
  }
  if (Number.isNaN(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid minute in timeOfDay: "${timeOfDay}".`);
  }
  if (Number.isNaN(second) || second < 0 || second > 59) {
    throw new Error(`Invalid second in timeOfDay: "${timeOfDay}".`);
  }

  return {
    hour,
    minute,
    second,
    normalized: `${hourStr}:${minuteStr}`,
  };
}

function parseLocalDateTime(localDateTimeStr: string): ParsedLocalDateTime {
  const match = localDateTimeStr.match(LOCAL_DATETIME_REGEX);
  if (!match) {
    throw new Error(`Invalid datetime format: "${localDateTimeStr}".`);
  }

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr = '00'] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if (Number.isNaN(year) || year < 1900 || year > 3000) {
    throw new Error(`Invalid year in datetime: "${localDateTimeStr}".`);
  }
  if (Number.isNaN(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month in datetime: "${localDateTimeStr}".`);
  }
  if (Number.isNaN(day) || day < 1 || day > 31) {
    throw new Error(`Invalid day in datetime: "${localDateTimeStr}".`);
  }
  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour in datetime: "${localDateTimeStr}".`);
  }
  if (Number.isNaN(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid minute in datetime: "${localDateTimeStr}".`);
  }
  if (Number.isNaN(second) || second < 0 || second > 59) {
    throw new Error(`Invalid second in datetime: "${localDateTimeStr}".`);
  }

  const baseDate = DateTime.fromObject({ year, month, day }, { zone: 'UTC' });
  if (!baseDate.isValid) {
    throw new Error(`Invalid date in datetime: "${localDateTimeStr}".`);
  }

  return { year, month, day, hour, minute, second };
}

function matchesLocal(dt: DateTime, params: ParsedLocalDateTime): boolean {
  return (
    dt.year === params.year &&
    dt.month === params.month &&
    dt.day === params.day &&
    dt.hour === params.hour &&
    dt.minute === params.minute &&
    dt.second === params.second
  );
}

function buildZonedDateTime(params: BuildDateTimeParams): DateTime {
  const {
    year,
    month,
    day,
    hour,
    minute,
    second,
    timezone,
    preferLateAmbiguous,
    operation,
  } = params;

  let dt = DateTime.fromObject(
    { year, month, day, hour, minute, second, millisecond: 0 },
    { zone: timezone }
  );

  let dstNote: string | null = null;

  if (!dt.isValid) {
    const baseLocal = DateTime.fromObject(
      { year, month, day, hour, minute, second, millisecond: 0 },
      { zone: 'UTC' }
    );

    let adjusted: DateTime | null = null;
    let shiftHours = 0;

    for (let offsetHours = 1; offsetHours <= 3; offsetHours++) {
      const candidateLocal = baseLocal.plus({ hours: offsetHours });
      const candidate = DateTime.fromObject(
        {
          year: candidateLocal.year,
          month: candidateLocal.month,
          day: candidateLocal.day,
          hour: candidateLocal.hour,
          minute: candidateLocal.minute,
          second: candidateLocal.second,
          millisecond: 0,
        },
        { zone: timezone }
      );

      if (candidate.isValid) {
        adjusted = candidate;
        shiftHours = offsetHours;
        break;
      }
    }

    if (!adjusted) {
      throw new Error(
        `Invalid datetime for timezone "${timezone}": ${year}-${month}-${day} ${hour}:${minute}:${second}.`
      );
    }

    dt = adjusted;
    dstNote = `spring-forward-shifted-${shiftHours}h`;
  }

  const localParams = { year, month, day, hour, minute, second };
  const earlierCandidate = dt.minus({ hours: 1 });
  const laterCandidate = dt.plus({ hours: 1 });

  if (matchesLocal(earlierCandidate, localParams) && earlierCandidate.offset !== dt.offset) {
    dt = preferLateAmbiguous ? dt : earlierCandidate;
    dstNote = preferLateAmbiguous ? 'ambiguous-fall-back-used-later' : 'ambiguous-fall-back-used-earlier';
  } else if (matchesLocal(laterCandidate, localParams) && laterCandidate.offset !== dt.offset) {
    dt = preferLateAmbiguous ? laterCandidate : dt;
    dstNote = preferLateAmbiguous ? 'ambiguous-fall-back-used-later' : 'ambiguous-fall-back-used-earlier';
  }

  if (dstNote) {
    logger.info(
      {
        operation,
        timezone,
        localInput: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
        localInterpretation: dt.toISO(),
        utcOffset: dt.toFormat('ZZ'),
        isDst: dt.isInDST,
        dstNote,
      },
      'DST adjustment applied'
    );
  }

  return dt;
}

// Timezone validation
export function isValidTimezone(tz: string): boolean {
  const normalized = tz.trim();
  if (!normalized) {
    return false;
  }
  if (!IANAZone.isValidZone(normalized)) {
    return false;
  }
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
}

export function validateTimezone(tz: string): void {
  if (!isValidTimezone(tz)) {
    throw new Error(
      `Invalid timezone: "${tz}". Must be a valid IANA timezone identifier (e.g., "America/New_York").`
    );
  }
}

// Health check for timezone support
export function validateTimezoneSupport(timezones: string[]): void {
  const failed: string[] = [];

  for (const tz of timezones) {
    try {
      const dt = DateTime.now().setZone(tz);
      if (!dt.isValid) {
        failed.push(tz);
      }
    } catch {
      failed.push(tz);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `Timezone support check failed for: ${failed.join(', ')}. ` +
      'Ensure Node.js has full ICU data installed.'
    );
  }

  logger.info({ timezones }, 'Timezone support validated');
}

export function localTimeToUtc(params: {
  hours: number;
  minutes: number;
  timezone: string;
  targetDate?: Date;
  preferLateAmbiguous?: boolean;
}): Date {
  const { hours, minutes, timezone, targetDate, preferLateAmbiguous = true } = params;

  validateTimezone(timezone);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values: ${hours}:${minutes}.`);
  }

  const base = targetDate
    ? DateTime.fromJSDate(targetDate).setZone(timezone)
    : DateTime.now().setZone(timezone);

  const dt = buildZonedDateTime({
    year: base.year,
    month: base.month,
    day: base.day,
    hour: hours,
    minute: minutes,
    second: 0,
    timezone,
    preferLateAmbiguous,
    operation: 'localTimeToUtc',
  });

  return dt.toUTC().toJSDate();
}

// Calculate next occurrence of time on specified days
export function getNextOccurrence(params: {
  timeOfDay: string;
  timezone: string;
  daysOfWeek: number[];
  afterDate?: Date;
}): Date {
  const { timeOfDay, timezone, daysOfWeek, afterDate } = params;

  validateTimezone(timezone);

  if (!daysOfWeek || daysOfWeek.length === 0) {
    throw new Error('daysOfWeek must contain at least one day');
  }

  const parsedTime = parseTimeOfDay(timeOfDay);

  const now = afterDate
    ? DateTime.fromJSDate(afterDate).setZone(timezone)
    : DateTime.now().setZone(timezone);

  let candidateDate = now;
  let candidate = buildZonedDateTime({
    year: candidateDate.year,
    month: candidateDate.month,
    day: candidateDate.day,
    hour: parsedTime.hour,
    minute: parsedTime.minute,
    second: parsedTime.second,
    timezone,
    preferLateAmbiguous: true,
    operation: 'getNextOccurrence',
  });

  if (candidate <= now) {
    candidateDate = candidateDate.plus({ days: 1 });
  }

  const luxonToOurDay = (luxonDay: number): number => (luxonDay % 7);

  let attempts = 0;
  while (!daysOfWeek.includes(luxonToOurDay(candidateDate.weekday)) && attempts < 8) {
    candidateDate = candidateDate.plus({ days: 1 });
    attempts++;
  }

  if (attempts >= 8) {
    throw new Error(`Could not find matching day in daysOfWeek: [${daysOfWeek.join(',')}]`);
  }

  candidate = buildZonedDateTime({
    year: candidateDate.year,
    month: candidateDate.month,
    day: candidateDate.day,
    hour: parsedTime.hour,
    minute: parsedTime.minute,
    second: parsedTime.second,
    timezone,
    preferLateAmbiguous: true,
    operation: 'getNextOccurrence',
  });

  const result = candidate.toUTC().toJSDate();

  logger.debug(
    {
      operation: 'getNextOccurrence',
      input: { timeOfDay, timezone, daysOfWeek, afterDate: afterDate?.toISOString() },
      localInterpretation: candidate.toISO(),
      utcOffset: candidate.toFormat('ZZ'),
      isDst: candidate.isInDST,
      resultUtc: result.toISOString(),
    },
    'Calculated next occurrence'
  );

  return result;
}

export function getNextReminderOccurrence(params: {
  rrule: string;
  timezone: string;
  timeOfDay: string;
  currentDueAt: Date;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  intervalDays?: number | null;
}): Date | null {
  const {
    rrule,
    timezone,
    timeOfDay,
    currentDueAt,
    daysOfWeek,
    dayOfMonth,
    intervalDays,
  } = params;

  validateTimezone(timezone);

  const parsedTime = parseTimeOfDay(timeOfDay);

  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);

  const freq = freqMatch?.[1] || 'DAILY';
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : (intervalDays || 1);

  const currentDt = DateTime.fromJSDate(currentDueAt).setZone(timezone);

  let nextDate = currentDt;

  switch (freq) {
    case 'DAILY':
      nextDate = currentDt.plus({ days: interval });
      break;

    case 'WEEKLY':
      if (daysOfWeek && daysOfWeek.length > 0) {
        let tempDate = currentDt.plus({ days: 1 });
        const luxonToOurDay = (d: number) => d % 7;
        let attempts = 0;

        while (!daysOfWeek.includes(luxonToOurDay(tempDate.weekday)) && attempts < 14) {
          tempDate = tempDate.plus({ days: 1 });
          attempts++;
        }

        if (interval > 1) {
          tempDate = tempDate.plus({ weeks: interval - 1 });
        }

        nextDate = tempDate;
      } else {
        nextDate = currentDt.plus({ weeks: interval });
      }
      break;

    case 'MONTHLY': {
      nextDate = currentDt.plus({ months: interval });
      const targetDay = dayOfMonth || currentDt.day;
      const actualDay = Math.min(targetDay, nextDate.daysInMonth);
      nextDate = nextDate.set({ day: actualDay });
      break;
    }

    default:
      logger.warn({ freq, rrule }, 'Unknown frequency in RRULE');
      return null;
  }

  const nextDt = buildZonedDateTime({
    year: nextDate.year,
    month: nextDate.month,
    day: nextDate.day,
    hour: parsedTime.hour,
    minute: parsedTime.minute,
    second: parsedTime.second,
    timezone,
    preferLateAmbiguous: true,
    operation: 'getNextReminderOccurrence',
  });

  const result = nextDt.toUTC().toJSDate();

  logger.debug(
    {
      operation: 'getNextReminderOccurrence',
      input: { rrule, timezone, timeOfDay, currentDueAt: currentDueAt.toISOString() },
      freq,
      interval,
      localInterpretation: nextDt.toISO(),
      utcOffset: nextDt.toFormat('ZZ'),
      isDst: nextDt.isInDST,
      resultUtc: result.toISOString(),
    },
    'Calculated next reminder occurrence'
  );

  return result;
}

// Convert local datetime string to UTC Date with timezone
export function localToUtc(localDateTimeStr: string, timezone: string): Date {
  validateTimezone(timezone);

  const { year, month, day, hour, minute, second } = parseLocalDateTime(localDateTimeStr);

  const dt = buildZonedDateTime({
    year,
    month,
    day,
    hour,
    minute,
    second,
    timezone,
    preferLateAmbiguous: false,
    operation: 'localToUtc',
  });

  return dt.toUTC().toJSDate();
}

// Format UTC date for display in a timezone
export function formatInTimezone(
  utcDate: Date,
  timezone: string,
  format: string = 'yyyy-MM-dd HH:mm'
): string {
  validateTimezone(timezone);
  return DateTime.fromJSDate(utcDate).setZone(timezone).toFormat(format);
}
