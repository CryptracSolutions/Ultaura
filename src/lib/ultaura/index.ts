// Ultaura Module Exports

export * from './accounts';
export * from './lines';
export * from './contacts';
export * from './verification';
export * from './schedules';
export * from './reminders';
export * from './reminder-events';
export * from './usage';
export * from './checkout';

export * from './types';
export * from './constants';
export * from './prompts';

export { getTrialStatus, getPlan } from './helpers';
export { getNextOccurrence, getNextReminderOccurrence } from './timezone';

/**
 * Get short line ID (first 8 chars of UUID) for cleaner URLs
 * Example: "a1b2c3d4-..." -> "a1b2c3d4"
 */
export function getShortLineId(lineId: string): string {
  return lineId.substring(0, 8);
}
