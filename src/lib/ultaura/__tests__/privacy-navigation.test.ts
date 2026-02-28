import { describe, expect, it } from 'vitest';

import {
  buildPrivacyUrl,
  parsePrivacySection,
  parsePrivacyTab,
} from '~/app/dashboard/(app)/privacy/lib/privacy-navigation';

describe('privacy navigation helpers', () => {
  it('builds tab-only URLs', () => {
    expect(buildPrivacyUrl('overview')).toBe('/dashboard/privacy?tab=overview');
  });

  it('builds tab + section URLs', () => {
    expect(buildPrivacyUrl('data', 'export')).toBe(
      '/dashboard/privacy?tab=data&section=export',
    );
  });

  it('parses only known tab values', () => {
    expect(parsePrivacyTab('consent')).toBe('consent');
    expect(parsePrivacyTab('invalid')).toBeNull();
    expect(parsePrivacyTab(null)).toBeNull();
  });

  it('parses only known section values', () => {
    expect(parsePrivacySection('retention')).toBe('retention');
    expect(parsePrivacySection('oops')).toBeNull();
    expect(parsePrivacySection(null)).toBeNull();
  });
});
