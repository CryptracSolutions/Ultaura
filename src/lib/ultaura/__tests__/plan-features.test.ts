import { describe, expect, it } from 'vitest';

import { PLANS } from '../constants';
import { DASHBOARD_PLAN_FEATURES } from '../plan-features';

describe('plan feature copy', () => {
  it('keeps Family included minutes aligned to the canonical 1,200 value', () => {
    expect(PLANS.family.minutesIncluded).toBe(1200);

    const familyMinutesFeature = DASHBOARD_PLAN_FEATURES.family[0];
    expect(familyMinutesFeature).toBe(
      `${PLANS.family.minutesIncluded.toLocaleString('en-US')} minutes per month`
    );
    expect(familyMinutesFeature).toContain('1,200');
    expect(familyMinutesFeature).not.toContain('2,200');
  });
});
