import 'server-only';

const QUOTE_WRAPPERS = /^["'""\u201C\u201D\u2018\u2019](.*)["'""\u201C\u201D\u2018\u2019]$/s;
const SPEAKER_LABELS =
  /^(?:mom|dad|caregiver|she|he|they|daughter|son|nurse|aide)\s+(?:said|noted|mentioned|reported|told)\s*[:.]?\s*/i;
const ATTRIBUTION_PREFIXES =
  /^(?:i\s+(?:noticed|think|saw|heard|feel|felt)|we\s+noticed|caregiver\s+reported|daughter\s+said|son\s+noted)\s*[:.]?\s*/i;
const REMAINING_QUOTES = /["'""\u201C\u201D\u2018\u2019]/;
const MAX_LENGTH = 240;

export function sanitizeSummaryParaphrase(input: string): string | null {
  let text = input.trim();
  if (!text) return null;

  // Strip direct quote wrappers
  const quoteMatch = text.match(QUOTE_WRAPPERS);
  if (quoteMatch) text = quoteMatch[1].trim();

  // Strip speaker labels
  text = text.replace(SPEAKER_LABELS, '').trim();

  // Strip attribution prefixes
  text = text.replace(ATTRIBUTION_PREFIXES, '').trim();

  // Capitalize first letter
  if (text.length > 0) {
    text = text[0].toUpperCase() + text.slice(1);
  }

  // Reject if remaining text still contains quotes
  if (REMAINING_QUOTES.test(text)) return null;

  if (!text || text.length < 3) return null;

  // Cap at 240 chars without cutting mid-word
  if (text.length > MAX_LENGTH) {
    text = text.slice(0, MAX_LENGTH).replace(/\s+\S*$/, '').trim();
    if (!text) return null;
  }

  return text;
}
