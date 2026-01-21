import { describe, expect, it } from 'vitest';
import { LANGUAGE_NAMES } from '@ultaura/prompts';
import { getFallbackMessage } from '../fallback-messages.js';

describe('getFallbackMessage', () => {
  it('returns messages for all supported languages', () => {
    const languages = Object.keys(LANGUAGE_NAMES);

    for (const language of languages) {
      expect(getFallbackMessage(language, 'retry_wait')).toEqual(expect.any(String));
      expect(getFallbackMessage(language, 'retry_failed')).toEqual(expect.any(String));
    }
  });
});

