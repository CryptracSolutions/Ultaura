import { describe, expect, it } from 'vitest';

import {
  filterAuditEntries,
  paginateAuditEntries,
} from '~/app/dashboard/(app)/privacy/hooks/useAuditFilters';
import type { ConsentAuditEntry } from '~/lib/ultaura/types';

function makeEntry(
  id: string,
  values: Partial<ConsentAuditEntry>,
): ConsentAuditEntry {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    accountId: 'acct_1',
    lineId: null,
    actorUserId: null,
    actorType: 'payer',
    action: 'recording_toggled',
    consentType: 'recording',
    oldValue: null,
    newValue: null,
    ipAddress: null,
    userAgent: null,
    callSessionId: null,
    metadata: null,
    ...values,
  };
}

describe('useAuditFilters helpers', () => {
  it('filters by consent, actor, and search text', () => {
    const entries: ConsentAuditEntry[] = [
      makeEntry('1', {
        action: 'recording_toggled',
        actorType: 'payer',
        consentType: 'recording',
      }),
      makeEntry('2', {
        action: 'sharing_consent_updated',
        actorType: 'line_voice',
        consentType: 'sharing',
        lineId: 'line_2',
      }),
    ];

    const filtered = filterAuditEntries(entries, {
      consentFilter: 'sharing',
      actorFilter: 'line_voice',
      search: 'line_2',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('2');
  });

  it('paginates with safe bounds', () => {
    const entries = [
      makeEntry('1', {}),
      makeEntry('2', {}),
      makeEntry('3', {}),
    ];

    const pagination = paginateAuditEntries(entries, 99, 2);

    expect(pagination.totalPages).toBe(2);
    expect(pagination.pageSafe).toBe(2);
    expect(pagination.startIndex).toBe(3);
    expect(pagination.endIndex).toBe(3);
    expect(pagination.paged.map((entry) => entry.id)).toEqual(['3']);
  });
});
