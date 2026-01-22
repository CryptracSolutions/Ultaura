import type { WellnessAlert } from './types';
import type { SharingTier } from '@ultaura/types';

export function redactAlertByTier(
  alert: WellnessAlert,
  tier: SharingTier
): WellnessAlert | null {
  if (tier === 'tier_1') {
    return null;
  }

  if (tier === 'tier_2' || tier === 'tier_3') {
    if (alert.alertType === 'mood_drop') {
      return {
        ...alert,
        title: 'Mood change noted',
        summary: 'A mood trend was observed during recent calls.',
      };
    }

    return {
      ...alert,
      title: 'Wellness observation',
      summary: 'A wellness observation was noted. Consider checking in.',
    };
  }

  return alert;
}
