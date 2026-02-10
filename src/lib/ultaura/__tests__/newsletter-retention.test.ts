import { beforeEach, describe, expect, it, vi } from 'vitest';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('newsletter retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when prune RPC returns an error', async () => {
    const { runNewsletterRetentionPrune } = await import('~/lib/ultaura/newsletter-retention');

    const client = {
      rpc: vi.fn(async () => ({ error: { message: 'rpc unavailable' } })),
    } as any;

    await expect(runNewsletterRetentionPrune(client)).rejects.toThrow(
      'Failed to prune newsletter operational data: rpc unavailable',
    );
  });

  it('throttles repeated prune scheduling calls', async () => {
    const { scheduleNewsletterRetentionPrune } = await import('~/lib/ultaura/newsletter-retention');

    const rpcMock = vi.fn(async () => ({ error: null }));
    const client = { rpc: rpcMock } as any;

    scheduleNewsletterRetentionPrune(client, 1_000);
    await flushPromises();

    scheduleNewsletterRetentionPrune(client, 1_500);
    await flushPromises();

    scheduleNewsletterRetentionPrune(client, 1_000 + 5 * 60 * 1000);
    await flushPromises();

    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it('captures prune failures instead of throwing into request paths', async () => {
    const { scheduleNewsletterRetentionPrune } = await import('~/lib/ultaura/newsletter-retention');

    const client = {
      rpc: vi.fn(async () => {
        throw new Error('db fail');
      }),
    } as any;

    const onErrorMock = vi.fn();
    scheduleNewsletterRetentionPrune(client, 9_999_999_999, onErrorMock);
    await flushPromises();

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});
