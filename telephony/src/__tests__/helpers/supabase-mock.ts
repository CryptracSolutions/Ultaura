import { vi, type Mock } from 'vitest';

/**
 * Creates a chainable query builder that resolves to the given result.
 * Supports: select, insert, update, delete, eq, neq, gt, lt, gte, lte,
 *           is, in, not, order, limit, single, maybeSingle
 */
export function createQueryBuilder(result: { data: unknown; error: unknown }): Record<string, Mock> {
  const builder: Record<string, Mock> = {};

  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
    'is', 'in', 'not', 'order', 'limit',
    'match', 'filter', 'contains', 'containedBy',
    'range', 'textSearch', 'or', 'and',
  ];

  for (const method of chainableMethods) {
    builder[method] = vi.fn(() => builder);
  }

  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);

  builder.then = vi.fn((resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve(result);
    return Promise.resolve(result);
  });

  return builder;
}

/**
 * Common RPC response factories.
 */
export const rpcResponses = {
  leaseAcquired: { data: true, error: null },
  leaseHeld: { data: false, error: null },
  leaseReleased: { data: true, error: null },
  completionSuccess: { data: true, error: null },
  completionClaimLost: { data: false, error: null },
  error: (msg: string) => ({ data: null, error: new Error(msg) }),
  emptyArray: { data: [], error: null },
};

/**
 * Creates a mock for globalThis.fetch.
 * Use with: vi.stubGlobal('fetch', createFetchMock(...))
 */
export function createFetchMock(responses: Array<{ ok: boolean; json: unknown }>): Mock {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({
      ok: response.ok,
      json: () => Promise.resolve(response.json),
    });
  });
}
