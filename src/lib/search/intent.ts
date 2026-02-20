import type { SearchCategory } from './types';
import { normalizeText, tokenizeText } from './match';

const CATEGORY_INTENT_KEYWORDS: Record<SearchCategory, string[]> = {
  navigation: ['go', 'open', 'page', 'dashboard', 'settings'],
  documentation: ['docs', 'documentation', 'guide', 'how to', 'help article'],
  lines: ['line', 'lines', 'member', 'loved one', 'senior profile'],
  reminders: ['reminder', 'remind', 'todo', 'task', 'remember'],
  schedules: ['schedule', 'check in', 'checkin', 'weekly', 'daily', 'time'],
  contacts: ['contact', 'contacts', 'person', 'people', 'phonebook'],
  calls: ['call', 'calls', 'phone', 'dial', 'voicemail', 'inbound', 'outbound'],
  safety_events: ['safety', 'alert', 'concern', 'danger', 'wellness', 'urgent', 'tier'],
};

const KEYWORD_BOOST = 3;
const PHRASE_BOOST = 5;
const MAX_BOOST = 10;

export function buildIntentBoostMap(query: string): Partial<Record<SearchCategory, number>> {
  const normalized = normalizeText(query);
  if (!normalized) {
    return {};
  }

  const tokens = tokenizeText(normalized, { minLength: 2, maxTokens: 16 });
  const tokenSet = new Set(tokens);
  const boosts: Partial<Record<SearchCategory, number>> = {};

  (Object.keys(CATEGORY_INTENT_KEYWORDS) as SearchCategory[]).forEach((category) => {
    const keywords = CATEGORY_INTENT_KEYWORDS[category];
    let score = 0;

    keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) {
        return;
      }

      const isPhrase = normalizedKeyword.includes(' ');
      if (isPhrase) {
        if (normalized.includes(normalizedKeyword)) {
          score += PHRASE_BOOST;
        }
        return;
      }

      if (tokenSet.has(normalizedKeyword)) {
        score += KEYWORD_BOOST;
      }
    });

    if (score > 0) {
      boosts[category] = Math.min(MAX_BOOST, score);
    }
  });

  return boosts;
}

export function getIntentBoost(
  boosts: Partial<Record<SearchCategory, number>>,
  category: SearchCategory
): number {
  return boosts[category] ?? 0;
}

