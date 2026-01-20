import { describe, it, expect } from 'vitest';
import { getVoicemailMessage } from '../voicemail-messages.js';

describe('voicemail-messages', () => {
  it('uses reminder-safe messaging for reminder calls', () => {
    const brief = getVoicemailMessage({
      name: 'Alex',
      language: 'en',
      preferredLanguageIso: 'en',
      behavior: 'brief',
      isReminderCall: true,
    });

    const detailed = getVoicemailMessage({
      name: 'Alex',
      language: 'en',
      preferredLanguageIso: 'en',
      behavior: 'detailed',
      isReminderCall: true,
    });

    expect(brief.toLowerCase()).toContain('reminder');
    expect(detailed.toLowerCase()).toContain('reminder');
  });
});
