/**
 * Generate a safe factual summary for telephony call context.
 * Returns null if no safe summary can be extracted.
 *
 * Spec Section 8.4 — 6-step algorithm:
 * 1. Normalize whitespace, collapse repeated punctuation, trim separators
 * 2. Strip direct-quote wrappers and speaker labels
 * 3. Strip caregiver-attribution phrases (including trailing subject noun)
 * 4. Keep only the first factual sentence candidate
 * 5. Reject if primarily opinion, instruction, meta-commentary, or emotional framing
 * 6. Cap at 140 characters
 */
export function ownerSafeSummary(rawText: string): string | null {
  // Step 1: Normalize whitespace, collapse repeated punctuation, trim separators
  // NOTE: Do NOT strip sentence-ending punctuation (.!?) — only strip true separators
  let text = rawText.replace(/\s+/g, ' ').trim();
  text = text.replace(/([.!?])\1+/g, '$1');
  text = text.replace(/^[-–—:;,\s]+|[-–—:;,\s]+$/g, '');

  if (!text) return null;

  // Steps 2+3: Iteratively strip quote wrappers, speaker labels, attribution phrases,
  // and trailing subject/possessive pronouns. Iterate because these nest:
  // "Caregiver noted: 'She said her knees hurt'" → step by step removal
  let prev = '';
  while (prev !== text) {
    prev = text;

    // Strip wrapping quotes (but preserve sentence-ending punctuation before the quote)
    text = text.replace(/^["'"']+\s*/, '').replace(/\s*["'"']+$/, '').trim();

    // Strip speaker labels: "Mom said:", "He said", "She said her...", etc.
    // Include optional trailing possessive/object pronouns that are part of reported speech
    text = text.replace(
      /^(?:mom|dad|grandma|grandpa|he|she|they|her|him|caregiver|daughter|son|wife|husband|partner|nurse|aide)\s+(?:said|says|told|mentioned|noted|reported)[\s:]*["'"']*\s*(?:(?:her|his|their|my|our)\s+)?/i,
      '',
    ).trim();

    // Strip caregiver-attribution phrases WITH trailing subject nouns AND possessive pronouns
    // "I noticed Mom seemed..." → "Seemed..."
    // "I think she may be..." → "May be..."
    text = text.replace(
      /^(?:I\s+(?:noticed|think|saw|heard|feel|felt|believe)|we\s+(?:noticed|think|saw)|caregiver\s+(?:reported|noted|said)|daughter\s+(?:said|noted|mentioned)|son\s+(?:said|noted|mentioned))[\s:,]*["'"']*\s*(?:(?:that|how)\s+)?(?:(?:mom|dad|grandma|grandpa|she|he|they|her|him|my\s+(?:mom|dad|mother|father|wife|husband))\s+)?(?:(?:her|his|their|my|our)\s+)?/i,
      '',
    ).trim();
  }

  if (!text) return null;

  // Final cleanup of any remaining leading quote marks
  text = text.replace(/^["'"']+\s*/, '').trim();

  if (!text) return null;

  // Step 4: Keep only the first factual sentence candidate
  const sentenceMatch = text.match(/^[^.!?]*[.!?]/);
  if (sentenceMatch) {
    text = sentenceMatch[0].trim();
  }

  // Step 5: Reject if primarily opinion, instruction, meta-commentary, or emotional framing
  // Scan the FULL text, not just the beginning
  const REJECTION_PATTERNS = [
    // Opinion/emotional framing — anywhere in text
    /\bI'?m\s+(?:scared|worried|afraid|terrified|concerned\s+that)\b/i,
    /\bI\s+worry\b/i,
    /\bI\s+hope\b/i,
    /\bI\s+just\s+wanted\s+to\s+(?:say|mention|let\s+you\s+know)\b/i,
    // Instructions/requests — anywhere in text
    /\bplease\s+(?:tell|remind|call|ask)\b/i,
    /\bremind\s+(?:her|him|them)\s+to\b/i,
    /\bcall\s+the\s+(?:doctor|clinic|hospital)\b/i,
  ];

  for (const pattern of REJECTION_PATTERNS) {
    if (pattern.test(text)) return null;
  }

  // Reject hedged/speculative statements with no concrete observable fact
  const HEDGE_WORDS = /\b(?:maybe|probably|perhaps|might|could\s+be)\b/i;
  const MAY_PATTERN = /\bmay\s+(?:be|have|need|not)\b/i;
  if (HEDGE_WORDS.test(text) || MAY_PATTERN.test(text)) {
    const withoutHedge = text
      .replace(/\b(?:maybe|probably|perhaps|might|could\s+be|may\s+(?:be|have|need|not))\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (withoutHedge.replace(/[^a-zA-Z]/g, '').length < 10) return null;
  }

  // Reject near-empty after processing
  if (text.replace(/[^a-zA-Z0-9]/g, '').length < 3) return null;

  // Step 6: Cap at 140 characters
  if (text.length > 140) {
    text = text.slice(0, 137) + '...';
  }

  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);

  return text;
}
