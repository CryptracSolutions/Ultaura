import { describe, expect, it, vi } from 'vitest';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { getScheduledReminderStatsByLine } from '../reminders';
import { getEffectiveReminderLimit } from '../helpers';

vi.mock('server-only', () => ({}));
vi.mock('~/core/supabase/server-component-client', () => ({
  default: vi.fn(),
}));

describe('getEffectiveReminderLimit', () => {
  it('uses trial plan while account is on trial', () => {
    const limit = getEffectiveReminderLimit({
      status: 'trial',
      trial_plan_id: 'comfort',
      plan_id: 'care',
    } as any);

    expect(limit).toBe(10);
  });

  it('falls back to plan_id when trial_plan_id is missing', () => {
    const limit = getEffectiveReminderLimit({
      status: 'trial',
      trial_plan_id: null,
      plan_id: 'care',
    } as any);

    expect(limit).toBe(5);
  });

  it('returns null for unlimited plans', () => {
    const limit = getEffectiveReminderLimit({
      status: 'active',
      plan_id: 'family',
      trial_plan_id: null,
    } as any);

    expect(limit).toBeNull();
  });
});

describe('getScheduledReminderStatsByLine', () => {
  it('aggregates scheduled reminders by line and preseeds requested line ids', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { line_id: 'line-1' },
                { line_id: 'line-1' },
                { line_id: 'line-2' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(getSupabaseServerComponentClient).mockReturnValue(mockClient as any);

    const stats = await getScheduledReminderStatsByLine('acct-1', ['line-1', 'line-2', 'line-3']);

    expect(stats).toEqual({
      'line-1': 2,
      'line-2': 1,
      'line-3': 0,
    });
  });
});
