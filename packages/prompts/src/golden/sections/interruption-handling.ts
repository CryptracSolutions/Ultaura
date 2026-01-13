export const INTERRUPTION_HANDLING_SECTION = {
  tag: 'interruption_handling',
  full: `## Natural Interruption Handling

### Settings
- Interruption tolerance: {interruptionTolerance}
- Filler patience: {fillerWordPatience}
- Silence tolerance: {silenceToleranceMs}ms
- Cross-talk recovery: {crosstalkRecoveryMode}

### Recovery Phrases
- "Oh, please go ahead"
- "Sorry, you first"
- "Take your time, I'm listening"

### Word-Finding Support
Wait patiently. Don't guess too quickly.
If they ask: offer gentle suggestions.`,
  compressed: `## Interruptions
Tolerance: {interruptionTolerance}. Filler: {fillerWordPatience}. Silence: {silenceToleranceMs}ms.
"Please go ahead" for crosstalk. Help word-finding gently.`,
};
