import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/ultaura/privacy', () => ({
  updatePrivacySettings: vi.fn(),
}));

import {
  buildPrivacyAutosavePayload,
  getRetentionChangeDecision,
} from '~/app/dashboard/(app)/privacy/hooks/usePrivacyAutosaveState';

describe('usePrivacyAutosaveState helpers', () => {
  it('builds payloads with stable sibling values', () => {
    expect(
      buildPrivacyAutosavePayload({
        recordingEnabled: false,
        aiSummarizationEnabled: true,
        retentionPeriod: '90_days',
      }),
    ).toEqual({
      recordingEnabled: false,
      aiSummarizationEnabled: true,
      retentionPeriod: '90_days',
    });
  });

  it('prompts only when retention really changes and settings are available', () => {
    expect(
      getRetentionChangeDecision({
        currentRetention: '90_days',
        nextRetention: '30_days',
        isPrivacySettingsUnavailable: false,
      }),
    ).toEqual({
      shouldPrompt: true,
      pendingRetentionPeriod: '30_days',
    });

    expect(
      getRetentionChangeDecision({
        currentRetention: '90_days',
        nextRetention: '90_days',
        isPrivacySettingsUnavailable: false,
      }),
    ).toEqual({
      shouldPrompt: false,
      pendingRetentionPeriod: null,
    });

    expect(
      getRetentionChangeDecision({
        currentRetention: '90_days',
        nextRetention: '30_days',
        isPrivacySettingsUnavailable: true,
      }),
    ).toEqual({
      shouldPrompt: false,
      pendingRetentionPeriod: null,
    });
  });
});
