import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => {
  const state = {
    entries: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Update 1',
        description: 'Description 1',
        category: 'new_feature',
        published: true,
        publishedAt: '2026-02-20T10:00:00.000Z',
        publishBatchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        emailSent: false,
        sortOrder: 0,
        createdAt: '2026-02-20T10:00:00.000Z',
        updatedAt: '2026-02-20T10:00:00.000Z',
      },
    ],
    accounts: [
      { id: 'acct-1', billing_email: 'family@example.com', status: 'active' },
      { id: 'acct-2', billing_email: 'family@example.com', status: 'trial' },
      { id: 'acct-3', billing_email: 'other@example.com', status: 'active' },
      { id: 'acct-4', billing_email: null, status: 'active' },
    ],
  };

  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  const sendEmail = vi.fn(async () => undefined);
  const renderEmail = vi.fn(() => ({ html: '<html>ok</html>', text: 'ok' }));
  const listChangelogEntries = vi.fn(async () => state.entries);
  const toChangelogEmailEntry = vi.fn((entry: any) => ({
    title: entry.title,
    description: entry.description,
    category: entry.category,
  }));

  const accountsInMock = vi.fn(async () => ({
    data: state.accounts,
    error: null,
  }));

  const fromMock = vi.fn((table: string) => {
    if (table === 'ultaura_accounts') {
      return {
        select: vi.fn(() => ({
          in: accountsInMock,
        })),
      };
    }

    return {
      select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })),
    };
  });

  const routeClientFactory = vi.fn(() => ({
    from: fromMock,
  }));

  return {
    state,
    logger,
    sendEmail,
    renderEmail,
    listChangelogEntries,
    toChangelogEmailEntry,
    fromMock,
    accountsInMock,
    routeClientFactory,
  };
});

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => mocks.logger),
}));

vi.mock('~/core/email/send-email', () => ({
  default: mocks.sendEmail,
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  default: mocks.routeClientFactory,
}));

vi.mock('~/lib/emails/changelog', () => ({
  renderChangelogEmail: mocks.renderEmail,
}));

vi.mock('~/lib/ultaura/changelog', () => ({
  ChangelogEmailRouteRequestSchema: z.object({
    batchId: z.string().uuid(),
    entryIds: z.array(z.string().uuid()).min(1),
  }),
  listChangelogEntries: mocks.listChangelogEntries,
  toChangelogEmailEntry: mocks.toChangelogEmailEntry,
}));

import { POST } from '~/app/api/internal/changelog-email/route';

function createRequest(body: unknown, secret = 'test-secret') {
  return new NextRequest('http://localhost/api/internal/changelog-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': secret,
    },
    body: JSON.stringify(body),
  });
}

describe('internal changelog email route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ULTAURA_INTERNAL_API_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.EMAIL_SENDER = 'Ultaura <hello@ultaura.com>';

    mocks.state.entries = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Update 1',
        description: 'Description 1',
        category: 'new_feature',
        published: true,
        publishedAt: '2026-02-20T10:00:00.000Z',
        publishBatchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        emailSent: false,
        sortOrder: 0,
        createdAt: '2026-02-20T10:00:00.000Z',
        updatedAt: '2026-02-20T10:00:00.000Z',
      },
    ];
    mocks.state.accounts = [
      { id: 'acct-1', billing_email: 'family@example.com', status: 'active' },
      { id: 'acct-2', billing_email: 'family@example.com', status: 'trial' },
      { id: 'acct-3', billing_email: 'other@example.com', status: 'active' },
      { id: 'acct-4', billing_email: null, status: 'active' },
    ];
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it('rejects an invalid secret', async () => {
    const response = await POST(
      createRequest(
        {
          batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          entryIds: ['11111111-1111-1111-1111-111111111111'],
        },
        'wrong-secret',
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('dedupes recipient emails and returns send counts', async () => {
    const response = await POST(
      createRequest({
        batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryIds: [
          '11111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111',
        ],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryCount: 1,
        recipientsAttempted: 2,
        recipientsSent: 2,
        recipientsFailed: 0,
        dedupedFrom: 1,
      }),
    );

    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    const recipients = mocks.sendEmail.mock.calls
      .map((call) => (call as unknown as Array<{ to: string }>)[0]?.to)
      .filter((value): value is string => typeof value === 'string')
      .sort();
    expect(recipients).toEqual(['family@example.com', 'other@example.com']);

    expect(mocks.listChangelogEntries).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ids: ['11111111-1111-1111-1111-111111111111'],
        published: true,
        publishBatchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      }),
    );
  });

  it('returns 207 and failed count when any email send fails', async () => {
    mocks.sendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('SMTP unavailable'));

    const response = await POST(
      createRequest({
        batchId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        entryIds: ['11111111-1111-1111-1111-111111111111'],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(body.success).toBe(false);
    expect(body.batchId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(body.recipientsAttempted).toBe(2);
    expect(body.recipientsSent).toBe(1);
    expect(body.recipientsFailed).toBe(1);
    expect(body.dedupedFrom).toBe(1);
    expect(body.failures).toHaveLength(1);

    expect(mocks.logger.error).toHaveBeenCalled();
    const [logMeta, logMessage] = mocks.logger.error.mock.calls[0] as [Record<string, unknown>, string];
    expect(logMessage).toBe('Failed to send changelog email');
    expect(logMeta).not.toHaveProperty('email');
    expect(String(logMeta.recipientEmailRedacted ?? '')).toContain('@example.com');
    expect(JSON.stringify(logMeta)).not.toContain('other@example.com');
  });
});
