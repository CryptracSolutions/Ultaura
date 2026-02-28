import { describe, expect, it } from 'vitest';

import {
  formatAction,
  formatActor,
  formatAuditValue,
  getSafeDownloadUrl,
} from '~/app/dashboard/(app)/privacy/lib/privacy-formatters';

describe('privacy formatters', () => {
  it('allows only https download links', () => {
    expect(getSafeDownloadUrl('https://example.com/file.zip')).toBe(
      'https://example.com/file.zip',
    );
    expect(getSafeDownloadUrl('javascript:alert(1)')).toBeNull();
    expect(getSafeDownloadUrl('http://example.com/file.zip')).toBeNull();
  });

  it('maps known audit actions to friendly labels', () => {
    expect(formatAction('voice_consent_denied')).toBe('Voice consent declined');
    expect(formatAction('sharing_reprompt_requested')).toBe('Sharing re-prompt requested');
  });

  it('falls back for unknown actions', () => {
    expect(formatAction('custom_future_action')).toBe('Custom Future Action');
  });

  it('formats actor and values for readability', () => {
    expect(formatActor('payer')).toBe('Account owner');
    expect(formatAuditValue(true)).toBe('Enabled');
    expect(formatAuditValue(false)).toBe('Disabled');
  });
});
