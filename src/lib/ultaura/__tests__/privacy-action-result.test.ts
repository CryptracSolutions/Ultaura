import { describe, expect, it } from 'vitest';

import { assertActionSucceeded } from '~/app/dashboard/(app)/privacy/lib/action-result';

describe('privacy action result guard', () => {
  it('does not throw for successful results', () => {
    expect(() =>
      assertActionSucceeded({ success: true }, 'Fallback error'),
    ).not.toThrow();
  });

  it('throws a string error message when provided', () => {
    expect(() =>
      assertActionSucceeded(
        { success: false, error: 'Deletion failed on server' },
        'Fallback error',
      ),
    ).toThrow('Deletion failed on server');
  });

  it('throws an object error message when provided', () => {
    expect(() =>
      assertActionSucceeded(
        { success: false, error: { message: 'Upgrade failed on server' } },
        'Fallback error',
      ),
    ).toThrow('Upgrade failed on server');
  });

  it('throws the fallback message when result has no error message', () => {
    expect(() =>
      assertActionSucceeded({ success: false }, 'Fallback error'),
    ).toThrow('Fallback error');
  });
});
