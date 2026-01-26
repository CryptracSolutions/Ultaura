import { describe, expect, it } from 'vitest';
import { evaluateSharingGate, filterPrivateTopics } from '../sharing-gate';

describe('sharing gate', () => {
  it('blocks non-safety insights when disabled, even for self', () => {
    const gate = evaluateSharingGate({
      userType: 'self',
      sharingConsent: 'pending',
      sharingTier: 'tier_1',
      isPaused: true,
      insightsEnabled: false,
      privateTopicCodes: [],
    });

    expect(gate.canAccessNonSafety).toBe(false);
    expect(gate.allowMood).toBe(false);
    expect(gate.allowTopics).toBe(false);
    expect(gate.allowConcerns).toBe(false);
    expect(gate.isFamilyOutputSuppressed).toBe(false);
    expect(gate.effectiveTier).toBe('tier_4');
  });

  it('allows tier-3 topic sharing for family-managed consented lines', () => {
    const gate = evaluateSharingGate({
      userType: 'family_managed',
      sharingConsent: 'granted',
      sharingTier: 'tier_3',
      isPaused: false,
      insightsEnabled: true,
      privateTopicCodes: [],
    });

    expect(gate.canAccessNonSafety).toBe(true);
    expect(gate.allowMood).toBe(true);
    expect(gate.allowTopics).toBe(true);
    expect(gate.allowConcerns).toBe(false);
    expect(gate.isFamilyOutputSuppressed).toBe(false);
  });

  it('suppresses family output when paused', () => {
    const gate = evaluateSharingGate({
      userType: 'family_managed',
      sharingConsent: 'granted',
      sharingTier: 'tier_4',
      isPaused: true,
      insightsEnabled: true,
      privateTopicCodes: [],
    });

    expect(gate.isFamilyOutputSuppressed).toBe(true);
  });

  it('requires consent for family-managed non-safety insights', () => {
    const gate = evaluateSharingGate({
      userType: 'family_managed',
      sharingConsent: 'pending',
      sharingTier: 'tier_2',
      isPaused: false,
      insightsEnabled: true,
      privateTopicCodes: [],
    });

    expect(gate.canAccessNonSafety).toBe(false);
    expect(gate.allowMood).toBe(false);
    expect(gate.allowTopics).toBe(false);
    expect(gate.allowConcerns).toBe(false);
  });

  it('filters private topic codes from topic lists', () => {
    const topics = [
      { code: 'family', label: 'Family' },
      { topic_code: 'friends', label: 'Friends' },
      { code: 'activities', label: 'Activities' },
    ];

    const filtered = filterPrivateTopics(topics, ['friends']);

    expect(filtered).toEqual([
      { code: 'family', label: 'Family' },
      { code: 'activities', label: 'Activities' },
    ]);
  });
});
