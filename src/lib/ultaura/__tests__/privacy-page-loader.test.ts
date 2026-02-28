import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

globalThis.React = React;

const loggerError = vi.fn();

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    error: loggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('~/lib/server/loaders/load-app-data', () => ({
  loadAppDataForUser: vi.fn(async () => ({ organization: { id: 123 } })),
}));

vi.mock('~/lib/ultaura/accounts', () => ({
  getUltauraAccount: vi.fn(async () => ({
    id: 'account-1',
    user_type: 'family_managed',
  })),
}));

vi.mock('~/lib/ultaura/lines', () => ({
  getLines: vi.fn(async () => []),
}));

vi.mock('~/lib/ultaura/privacy', () => ({
  getAccountPrivacySettings: vi.fn(async () => null),
  getConsentAuditLog: vi.fn(async () => {
    throw new Error('audit failed');
  }),
  getDataExportRequests: vi.fn(async () => []),
  getLineVoiceConsents: vi.fn(async () => []),
}));

vi.mock('~/lib/ultaura/notification-recipients', () => ({
  getNotificationRecipients: vi.fn(async () => []),
}));

describe('privacy page loader logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs rejected Promise.allSettled entries with source labels', async () => {
    const { default: PrivacyCenterPage } = await import('~/app/dashboard/(app)/privacy/page');

    await PrivacyCenterPage();

    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        source: 'getConsentAuditLog',
      }),
      'Privacy page loader Promise.allSettled operation rejected',
    );
  });
});
