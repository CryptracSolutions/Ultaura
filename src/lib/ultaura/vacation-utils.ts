export interface VacationRange {
  start: string;
  end: string;
}

export function parseVacationRanges(value: unknown): VacationRange[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((range) => {
      if (!range || typeof range !== 'object') return null;
      const start = (range as { start?: unknown }).start;
      const end = (range as { end?: unknown }).end;
      if (typeof start !== 'string' || typeof end !== 'string') return null;
      return { start, end };
    })
    .filter((range): range is VacationRange => Boolean(range));
}
