import { describe, expect, it } from 'vitest';
import { createUltauraCheckout, getUltauraPriceId } from '../checkout';

describe('checkout', () => {
  it('returns the configured price id', () => {
    const previous = process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID;
    process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID = 'price_test_care_monthly';

    const priceId = getUltauraPriceId('care', 'monthly');
    expect(priceId).toBe('price_test_care_monthly');

    if (previous === undefined) {
      delete process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID;
    } else {
      process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID = previous;
    }
  });

  it('rejects invalid plans', async () => {
    const result = await createUltauraCheckout(
      'invalid_plan',
      'monthly',
      'org-test',
      'https://example.com/return'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid plan selected');
  });
});
