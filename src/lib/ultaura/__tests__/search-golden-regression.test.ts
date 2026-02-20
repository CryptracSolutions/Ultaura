import { describe, expect, it } from 'vitest';

import { buildIntentBoostMap, getIntentBoost } from '../../search/intent';
import { scoreMatch } from '../../search/match';
import type { SearchCategory } from '../../search/types';

const GOLDEN_CANDIDATES: Record<SearchCategory, string> = {
  navigation: 'Dashboard settings home usage billing privacy',
  documentation: 'Documentation guide help article',
  lines: 'Line profile Robert Chen +15551000002',
  reminders: 'Reminder take medicine at 8 AM',
  schedules: 'Schedule check in call every Tuesday at 9 AM',
  contacts: 'Trusted contact Dr Sarah Kim +15555550305 Robert Chen',
  calls: 'Outbound call completed Robert Chen +15551000002 phone dial',
  safety_events: 'Safety alert medium tier General Concern wellness event',
};

function rankGoldenQuery(query: string): SearchCategory {
  const boosts = buildIntentBoostMap(query);

  const ranked = (Object.keys(GOLDEN_CANDIDATES) as SearchCategory[])
    .map((category) => ({
      category,
      score: scoreMatch(query, GOLDEN_CANDIDATES[category]) + getIntentBoost(boosts, category),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0].category;
}

describe('golden search query regression matrix', () => {
  it.each([
    { query: 'call', expected: 'calls' },
    { query: 'phone', expected: 'calls' },
    { query: 'safety', expected: 'safety_events' },
    { query: 'general concern', expected: 'safety_events' },
    { query: 'safty', expected: 'safety_events' },
    { query: 'contact robert', expected: 'contacts' },
    { query: 'remind me medicine', expected: 'reminders' },
    { query: 'check in schedule', expected: 'schedules' },
  ])('ranks "$query" to expected top category', ({ query, expected }) => {
    expect(rankGoldenQuery(query)).toBe(expected);
  });
});

